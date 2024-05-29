const StaticAuthProvider = require('@twurple/auth').StaticAuthProvider;
const PubSubClient = require('@twurple/pubsub').PubSubClient;
const ApiClient = require('@twurple/api').ApiClient;
const fs = require('node:fs');
const config = require("./config.json")
const pathToCP = config.cyberpunkModPath;
const sqlite3 = require('sqlite3').verbose();
const tmi = require('tmi.js');

const TWITCH_PLATFORM = "twitch";
const LOCAL_PLATFORM = "local";
const INFINITE_POINTS = true;

const readline = require('node:readline');
const { HelixCustomRewardRedemption } = require('@twurple/api');

const serverCLI = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

var db = new sqlite3.Database('db.sqlite3', sqlite3.OPEN_READWRITE, (err) => {
  if (err) return console.error(err.message);
});
var twitchClient = undefined;

const regexpCommand = new RegExp(/^!([a-zA-Z0-9]+)(?:\W+)?(.*)?/);
const MESSAGE_COMMAND_TYPE = "MESSAGE"
const WriteToLog = (content) => {
  fs.appendFile(pathToCP + '/currentLogs.log', content + "\n", err => {
    if (err) {
      console.error(err);
    } else {
      // done!
    }
  });
}

const sendMessageViaPlatform = (platform, username, channel, message) => {
  if (platform === LOCAL_PLATFORM) {
    console.log(message);
  }
  else if (platform === TWITCH_PLATFORM) {
    twitchClient.say(channel, message);
  }
}

const clearDB = () => {
  const eventTable = `DROP TABLE events`
  const pointsTable = `DROP TABLE users`
  db.run(eventTable, (err) => {
    if (err) return console.error(err.message);
  });
  db.run(pointsTable, (err) => {
    if (err) console.error(err.message);
  });
}

const initDB = () => {
  const eventTable = `CREATE TABLE events(id INTEGER PRIMARY KEY, username TEXT, event_type TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, cost INTEGER, platform TEXT, channel TEXT)`
  const pointsTable = `CREATE TABLE users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, last_point_allocation DATETIME DEFAULT CURRENT_TIMESTAMP, is_disabled INTEGER, joined DATETIME DEFAULT CURRENT_TIMESTAMP, total_points INTEGER, platform TEXT, channel TEXT)`
  db.run(eventTable, (err) => {
    if (err) return console.error(err.message);
  });
  db.run(pointsTable, (err) => {
    if (err) console.error(err.message);

    //Update timestamp between stream or crash to ensure no extra points
    const setPointsQuery = `UPDATE users SET last_point_allocation = CURRENT_TIMESTAMP`
    db.run(setPointsQuery, (err) => {
      if (err) return console.error(err.message);
    });
  });

}

const signUpUser = (username, channel, params, platform) => {
  const addToTable = `INSERT INTO users VALUES (NULL, "${username}", CURRENT_TIMESTAMP, 0, CURRENT_TIMESTAMP, ${config.starterPoints}, "${platform}", "${channel}")`
  db.run(addToTable, (err) => {
    if (err) {
      console.log(err);
      sendMessageViaPlatform(platform, username, channel, `@${username} You have already entered`)
    }
    else {
      sendMessageViaPlatform(platform, username, channel, `@${username} welcome choom, you start with ${config.starterPoints} points to spend.`)
    }
  })
}

const setPoints = (username, points) => {
  if (config.useChannelPoints) {
    return;
  }
  const setPointsQuery = `UPDATE users SET total_points = ${points}, last_point_allocation = CURRENT_TIMESTAMP WHERE username = "${username}"`
  db.run(setPointsQuery, (err) => {
    if (err) return console.error(err.message);
  });
}

const getPoints = (userRecord) => {
  if (INFINITE_POINTS || config.useChannelPoints) {
    return Number.MAX_SAFE_INTEGER;
  }
  const lastPointInterval = new Date(userRecord["last_point_allocation"] + " UTC");
  const now = new Date();
  let points = userRecord["total_points"];
  if (now - lastPointInterval >= config.interval) {
    points += Math.floor((now - lastPointInterval) / config.interval) * config.pointsPerInterval;
    setPoints(userRecord.username, points)
  }
  return points;
}

const checkBalance = (username, channel, params, platform) => {
  const query = `SELECT * FROM users WHERE username = "${username}"`
  db.all(query, function (err, rows) {
    if (err || rows.length === 0) {
      console.log(err);
      sendMessageViaPlatform(platform, username, channel, `@${username} you may not be entered you gonk, type !newchoom to enter.`)
    } else {
      const user = rows[0];
      if (user["is_disabled"]) {
        return;
      }
      const points = getPoints(user);
      sendMessageViaPlatform(platform, username, channel, `@${username} you have ${points} points in the bank right now.`)
    }
  });
}

const writeEventLog = (username, effect, cost, platform, channel) => {
  const addEvent = `INSERT INTO events VALUES (NULL, "${username}", "${effect}", CURRENT_TIMESTAMP, ${cost}, "${platform}", "${channel}")`
  db.run(addEvent, (err) => {
    if (err) return console.error(err.message);
  });
}

const allowedQuickHacks = {
  "overload": {
    "cost": 100
  },
  "overheat": {
    "cost": 100
  }
}

const allowedStatusEffects = {
  "frozen": {
    "cost": 200
  },
  "blind": {
    "cost": 200
  },
  "bleeding": {
    "cost": 100
  },
  "drunk": {
    "cost": 100
  }
}

const effects = {
  "takemoney": {
    "effectType": "LOSE_MONEY",
    "min": 1,
    "max": 100000,
    "calculatedCost": (level) => {
      let div = Math.floor(level / 10);
      if (div === 0) {
        div = 1;
      }
      return div;
    }
  },
  "addmoney": {
    "effectType": "ADD_MONEY",
    "min": 1,
    "max": 100000,
    "calculatedCost": (level) => {
      let div = Math.floor(level / 10);
      if (div === 0) {
        div = 1;
      }
      return div;
    }
  },
  "wanted": {
    "max": 5,
    "min": 1,
    "effectType": "wanted",
    "calculatedCost": (level) => {
      return 400 * level;
    }
  },
  "quickhack": {
    "effectType": "quickhack",
    "calculatedCost": (level) => {
      return allowedQuickHacks[level].cost;
    }
  },
  "statuseffect": {
    "effectType": "statuseffect",
    "duration": 30,
    "calculatedCost": (level) => {
      return allowedStatusEffects[level].cost;
    }
  },
  "killplayer": {
    "effectType": "killplayer",
    "cost": 100000
  },
  "upsidedown": {
    "effectType": "upsidedown",
    "cost": 500,
    "duration": 30
  },
  "doomvision": {
    "effectType": "doomvision",
    "cost": 100,
    "duration": 30
  },
  "preyvision": {
    "effectType": "preyvision",
    "cost": 100,
    "duration": 30
  },
  "smashing": {
    "effectType": "smashing",
    "cost": 5000
  },
  "chimera": {
    "effectType": "chimera",
    "cost": 10000
  },
  "kurt": {
    "effectType": "kurt",
    "cost": 5000
  },
  "slowdown": {
    "effectType": "slowdown",
    "cost": 500,
    "duration": 30,
    "amount": 0.5
  },
  "speedup": {
    "effectType": "speedup",
    "cost": 500,
    "duration": 30,
    "amount": 5
  },
  "carpocolypse": {
    "effectType": "carpocolypse",
    "cost": 500,
  },
  "carsbepopin": {
    "effectType": "carsbepopin",
    "cost": 500,
  },
  "tankrain": {
    "effectType": "carsbepopin",
    "cost": 100,
  },
  "dropweapons": {
    "effectType": "dropweapons",
    "cost": 1000,
  },
  "forceweapon": {
    "effectType": "forceweapon",
    "cost": 100
  },
  "onehit": {
    "effectType": "onehit",
    "cost": 2000
  },
  "heal": {
    "effectType": "heal",
    "cost": 2000
  },
  "refillammo": {
    "effectType": "refillammo",
    "cost": 2000
  },
  "removeammo": {
    "effectType": "removeammo",
    "cost": 2000
  },
  "infiniteammo": {
    "effectType": "infiniteammo",
    "cost": 5000,
    "duration": 30
  },
  "immortal": {
    "effectType": "immortal",
    "cost": 5000,
    "duration": 30
  },
}

const sendEffect = (effect, username, channel, amount, platform) => {
  const effectConfig = effects[effect];
  const applyEffect = (user) => {
    if (effectConfig.min !== undefined && (amount < effectConfig.min || Number.isNaN(amount))) {
      sendMessageViaPlatform(platform, username, channel, `@${username} amount specified is either not a number or too low`);
      return;
    }
    if (effectConfig.max !== undefined && (amount > effectConfig.max || Number.isNaN(amount))) {
      sendMessageViaPlatform(platform, username, channel, `@${username} amount specified is either not a number or too high`);
      return;
    }
    let cost = effectConfig.cost;
    let total = effectConfig.amount;
    if (amount !== undefined) {
      total = amount;
    }
    if (effectConfig.calculatedCost !== undefined) {
      cost = effectConfig.calculatedCost(amount)
    }
    const data = { "commandType": effect, "username": username, "amount": total };
    if (effectConfig.duration) {
      data.duration = effectConfig.duration;
    }
    const points = getPoints(user);
    if (points >= cost) {
      setPoints(username, points - cost);
      writeEventLog(username, effect, cost, platform, channel);
      WriteToLog(JSON.stringify(data));
    }
    else {
      sendMessageViaPlatform(platform, username, channel, `@${username} you don't have enough, need ${cost} but you have ${points}`)
    }
  };
  if (config.useChannelPoints) {
    applyEffect();
  }
  else {
    const query = `SELECT * FROM users WHERE username = "${username}"`
    db.all(query, function (err, rows) {
      if (err || rows.length === 0) {
        console.log(err);
        sendMessageViaPlatform(platform, username, channel, `@${username} you may not be entered you gonk, type !newchoom to enter.`)
      } else {
        const user = rows[0];
        if (user["is_disabled"]) {
          return;
        }
        applyEffect(user);
      }
    });
  }

}

const giveUserPoints = (username, channel, amount, platform) => {
  const query = `SELECT * FROM users WHERE username = "${username}"`
  db.all(query, function (err, rows) {
    if (err || rows.length === 0) {
      console.log(err);
      signUpUser(username, channel, amount, platform);
    } else {
      const user = rows[0];
      if (user["is_disabled"]) {
        return;
      }
      const points = getPoints(user) + 1000;
      setPoints(username, points);
      sendMessageViaPlatform(user.platform, username, user.channel, `@${username} you were given ${points}`);
    }
  });
}

const refundUser = (username, channel, id, platform) => {
  const query = `SELECT * FROM events WHERE id = ${id}`
  db.all(query, function (err, rows) {
    if (err || rows.length === 0) {
      console.log(err);
    } else {
      const event = rows[0];
      const query = `SELECT * FROM users WHERE username = "${event.username}"`
      db.all(query, function (err, rows) {
        if (err || rows.length === 0) {
          console.log(err);
        } else {
          const user = rows[0];
          const points = getPoints(user) + event.cost;
          setPoints(username, points);
          sendMessageViaPlatform(user.platform, username, user.channel, `@${user.username} you were refunded ${event.cost} with a new total balance of ${points}`);
          const addEvent = `DELETE FROM events WHERE id = ${id}`
          db.run(addEvent, (err) => {

          });
        }
      });
    }
  });
};

const commands = {
  "newchoom": {
    "execute": signUpUser,
    "isDisabled": config.useChannelPoints,
    "help": `Signs you up to gain points to spend on effects. You gain ${config.pointsPerInterval} points per ${config.interval / 1000} seconds.`
  },
  "givepoints": {
    "execute": giveUserPoints,
    "help": `Gives points to specified user, takes username and gives 1000 points.`,
    "allowedPlatforms": [LOCAL_PLATFORM],
    "hasParams": true,
    "parseParams": (param) => param
  },
  "refundEvent": {
    "execute": refundUser,
    "help": `Refunds an event to the user, takes event id.`,
    "isDisabled": config.useChannelPoints,
    "allowedPlatforms": [LOCAL_PLATFORM],
    "hasParams": true,
    "parseParams": (param) => param
  },
  "balance": {
    "execute": checkBalance,
    "help": "Check how many points you currently have.",
    "isDisabled": config.useChannelPoints,
  },
  "addmoney": {
    "execute": (username, channel, amount, platform) => { sendEffect("addmoney", username, channel, amount, platform) },
    "help": "Add money from the player whose point cost is 1/4 the amount of money."
  },
  "takemoney": {
    "execute": (username, channel, amount, platform) => { sendEffect("takemoney", username, channel, amount, platform) },
    "help": "Removes money from the player whose point cost is 1/4 the amount of money.",
    "hasParams": true,
    "parseParams": (param) => {
      return Number.parseInt(param);
    }
  },
  "wanted": {
    "execute": (username, channel, amount, platform) => { sendEffect("wanted", username, channel, amount, platform) },
    "hasParams": true,
    "parseParams": (param) => {
      return Number.parseInt(param);
    }
  },
  "quickhack": {
    "execute": (username, channel, amount, platform) => { sendEffect("quickhack", username, channel, amount, platform) },
    "help": `Lets you quick hack the player for ${effects.quickhack.duration} seconds. Allowed values and cost ${Object.keys(allowedQuickHacks).map((status) => `${status}: ${allowedQuickHacks[status].cost} points`).join(", ")}`,
    "hasParams": true,
    "isDisabled": true,
    "parseParams": (param) => {
      const allowedHacks = Object.keys(allowedQuickHacks);
      if (allowedHacks.find((p) => p === param) === undefined) {
        throw new Error(`not a valid quick hack, only ${allowedHacks.join(", ")} are allowed.`)
      }
      return param;
    }
  },
  "statuseffect": {
    "execute": (username, channel, amount, platform) => { sendEffect("statuseffect", username, channel, amount, platform) },
    "help": `Gives the player a status effect for ${effects.statuseffect.duration} seconds.Allowed values and cost ${Object.keys(allowedStatusEffects).map((status) => `${status}: ${allowedStatusEffects[status].cost} points`).join(", ")}`,
    "hasParams": true,
    "parseParams": (param) => {
      const statusEffects = Object.keys(allowedStatusEffects);
      if (statusEffects.find((p) => p === param) === undefined) {
        throw new Error(`not a valid status effect, only ${statusEffects.join(", ")} are allowed.`)
      }
      return param;
    }
  },
  "killplayer": {
    "execute": (username, channel, amount, platform) => { sendEffect("killplayer", username, channel, amount, platform) },
    "help": `kills player for ${effects.killplayer.cost} points`
  },
  "upsidedown": {
    "execute": (username, channel, amount, platform) => { sendEffect("upsidedown", username, channel, amount, platform) },
    "help": `Flips the players camera for ${effects.upsidedown.cost} points`
  },
  "doomvision": {
    "execute": (username, channel, amount, platform) => { sendEffect("doomvision", username, channel, amount, platform) },
    "help": `Gives the player doom vision for ${effects.doomvision.duration} seconds for ${effects.doomvision.cost} points`
  },
  "preyvision": {
    "execute": (username, channel, amount, platform) => { sendEffect("preyvision", username, channel, amount, platform) },
    "help": `Gives the player prey vision for ${effects.preyvision.duration} seconds for ${effects.preyvision.cost} points`
  },
  "smashing": {
    "execute": (username, channel, amount, platform) => { sendEffect("smashing", username, channel, amount, platform) },
    "help": `The man the myth the legend for ${effects.smashing.cost} points`
  },
  "kurt": {
    "execute": (username, channel, amount, platform) => { sendEffect("kurt", username, channel, amount, platform) },
    "help": `The other legend for ${effects.kurt.cost} points`
  },
  "slowdown": {
    "execute": (username, channel, amount, platform) => { sendEffect("slowdown", username, channel, amount, platform) },
    "help": `Have the player enter slow mo for ${effects.slowdown.cost} points`
  },
  "speedup": {
    "execute": (username, channel, amount, platform) => { sendEffect("speedup", username, channel, amount, platform) },
    "help": `Have the player go fast for ${effects.speedup.cost} points`
  },
  "carpocolypse": {
    "execute": (username, channel, amount, platform) => { sendEffect("carpocolypse", username, channel, amount, platform) },
    "help": `All cars around go boom for ${effects.carpocolypse.cost} points`
  },
  "carsbepopin": {
    "execute": (username, channel, amount, platform) => { sendEffect("carsbepopin", username, channel, amount, platform) },
    "help": `All tires around go boom for ${effects.carsbepopin.cost} points`
  },
  "tankrain": {
    "execute": (username, channel, amount, platform) => { sendEffect("tankrain", username, channel, amount, platform) },
    "help": `Its raining tanks for ${effects.tankrain.cost}`
  },
  "dropweapons": {
    "execute": (username, channel, amount, platform) => { sendEffect("dropweapons", username, channel, amount, platform) },
    "help": `Forces the player to drop all weapons for ${effects.dropweapons.cost}`
  },
  "forceweapon": {
    "execute": (username, channel, amount, platform) => { sendEffect("forceweapon", username, channel, amount, platform) },
    "help": `Everyone loves budget fire arms for ${effects.dropweapons.cost}`
  },
  "onehit": {
    "execute": (username, channel, amount, platform) => { sendEffect("onehit", username, channel, amount, platform) },
    "help": `Puts the player at 1 hp for ${effects.onehit.cost}`
  },
  "heal": {
    "execute": (username, channel, amount, platform) => { sendEffect("heal", username, channel, amount, platform) },
    "help": `Heals the player to full for ${effects.heal.cost}`
  },
  "refillammo": {
    "execute": (username, channel, amount, platform) => { sendEffect("refillammo", username, channel, amount, platform) },
    "help": `Refills all the players ammo for ${effects.refillammo.cost}`
  },
  "removeammo": {
    "execute": (username, channel, amount, platform) => { sendEffect("removeammo", username, channel, amount, platform) },
    "help": `Removes all the players ammo for ${effects.removeammo.cost}`
  },
  "infiniteammo": {
    "execute": (username, channel, amount, platform) => { sendEffect("infiniteammo", username, channel, amount, platform) },
    "help": `Gives the player infinite ammo for ${effects.infiniteammo.cost} for ${effects.infiniteammo.duration} seconds`
  },
  "immortal": {
    "execute": (username, channel, amount, platform) => { sendEffect("immortal", username, channel, amount, platform) },
    "help": `Makes the player immortal for ${effects.immortal.cost} for ${effects.immortal.duration} seconds`
  }
}

const executeCommand = (username, userCommand, argument, channel, platform) => {
  console.log(userCommand);
  let found = false;
  const keys = Object.keys(commands);
  for (var key in keys) {
    const command = keys[key];
    const commandConfig = commands[command];
    if (userCommand === command && !commandConfig.isDisabled && (commandConfig.allowedPlatforms === undefined || commandConfig.allowedPlatforms.find((plat) => plat === platform) !== undefined)) {
      let execute = commandConfig.execute;
      let params = undefined;
      if (commandConfig.hasParams) {
        params = argument;
        if (typeof params === 'string' && params.toLowerCase() === "help") {
          sendMessageViaPlatform(platform, username, channel, `@${username} ${commandConfig.help}`);
          return
        }
        if (commandConfig.parseParams !== undefined) {

          try {
            params = commandConfig.parseParams(params);
          }
          catch (e) {
            console.error(e);
            sendMessageViaPlatform(platform, username, channel, e.message);
          }
        }
      }
      execute(username, channel, params, platform);
      found = true;
      break;
    }
  }
  if (!found) {
    if (userCommand === "commandlist" || userCommand === "help") {
      const commandList = [];
      for (var key in keys) {
        const command = keys[key];
        const commandConfig = commands[command];
        if (!commandConfig.isDisabled && (commandConfig.allowedPlatforms === undefined || commandConfig.allowedPlatforms.find((plat) => plat === platform) !== undefined))
          commandList.push("!" + command);
      }
      sendMessageViaPlatform(platform, username, channel, `@${username} !The list of commands are: ${commandList.join(", ")}. Type <command> help to get the details about the command.`);
    }
  }
}

const cliAskQuestion = () => {
  serverCLI.question(`Enter Command  `, cmd => {
    const [command, args] = cmd.split(" ");
    let finalCommand = command;
    if (command.startsWith("!")) {
      finalCommand = command.substring(1);
    }
    executeCommand("local", finalCommand, args, LOCAL_PLATFORM, LOCAL_PLATFORM);
    cliAskQuestion();
  });
}

/**
 * 
 * @param {ApiClient} apiClient 
 */
const createChannelPointRewards = async (apiClient, broadcaster) => {
  
  await Object.keys(effects).forEach(async (effect) => {
    const commandCfg = commands[effect];
    if(commandCfg !== undefined && !commandCfg.isDisabled && (commandCfg.allowedPlatforms === undefined || commandCfg.allowedPlatforms.find((plat) => plat === TWITCH_PLATFORM) !== undefined)){
      const effectConfig = effects[effect];
      let cost = effectConfig.cost;
      if(effectConfig.calculatedCost !== undefined){
        if(effect === "statuseffect"){
          cost = effectConfig.calculatedCost("blind");
        }
        else if(effectConfig.max !== undefined){
          cost = effectConfig.calculatedCost(effectConfig.max);
        }
        else{
          cost = effectConfig.calculatedCost();
        }
      }
      const color = '#'+(Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
      let cooldown = 60;
      if(cost >= 5000){
        cooldown = 300;
      }
      cost = Math.floor(cost / 5); //To make this affordable
      if(cost <= 0){
        cost = 100;
      }
      await apiClient.channelPoints.createCustomReward(broadcaster, {cost, title: effect, isEnabled: true, userInputRequired: commandCfg.hasParams, prompt: commandCfg.help, backgroundColor: color, globalCooldown: cooldown});
    }
  })

}

const init = async () => {
  //clearDB();
  if(!config.useChannelPoints){
    initDB();
  }
  process.stdin.resume(); // so the program will not close instantly
  let channelPointListener = [];
  if (config.useChannelPoints) {
    const authProvider = new StaticAuthProvider(config.twitchCredentials.clientId, config.twitchCredentials.clientSecret, ['channel:read:redemptions', 'channel:manage:redemptions']);
    const apiClient = new ApiClient({ authProvider, logger: {
      minLevel: 'debug'
    } });

    const pubSubClient = new PubSubClient({ authProvider });
    await Object.keys(config.channels).forEach(async (channel) => {
      console.log(`Creating channel point listener for ${channel}`);
      const user = await apiClient.users.getUserByName(channel);
      if(config.createChannelPointRewards){
        await createChannelPointRewards(apiClient, user);
      }
      const channelConfig = config.channels[channel];
      const handler = pubSubClient.onRedemption(channelConfig.channelId, async (message) => {
        const reward = message.rewardTitle.toLowerCase().replace(/ /g, "");
        const commandConfig = commands[reward];
        if (reward !== undefined && message.rewardIsQueued && commandConfig !== undefined && !commandConfig.isDisabled && (commandConfig.allowedPlatforms === undefined || commandConfig.allowedPlatforms.find((plat) => plat === TWITCH_PLATFORM) !== undefined)) {
          let execute = commandConfig.execute;
          let params = undefined;
          console.log(message.message);
          if (commandConfig.hasParams) {
            if(message.message === undefined || message.message === ""){
              twitchClient.say(channelConfig.channelName, `@${message.userName} you have to enter values for ${message.rewardTitle}`);
              apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "CANCELED");
            }
            params = message.message;
            if (commandConfig.parseParams !== undefined) {
              try {
                params = commandConfig.parseParams(params);
              }
              catch (e) {
                console.error(e);
                twitchClient.say(channelConfig.channelName, `@${message.userName} you have entered invalid values for ${message.rewardTitle}`);
                apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "CANCELED");
                return;
              }
            }
          }
          execute(message.userName, channelConfig.channelName, params, TWITCH_PLATFORM);
          apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "FULFILLED");
        }
        else {
          twitchClient.say(channelConfig.channelName, `@${channelConfig.channelName} oh no, looks like channel point reward ${message.rewardTitle} is not a valid command, bad streamer.`);
          apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "CANCELED");
        }
      });
      channelPointListener.push(handler);
    })
  }
  const exitHandler = async (options, exitCode) => {
    if(!config.useChannelPoints){
      await db.close();
    }
    serverCLI.close();
    for (let client of channelPointListener) {
      client.remove();
    }
    if (options.cleanup) console.log('clean');
    if (exitCode || exitCode === 0) console.log(exitCode);
    if (options.exit) process.exit();
  }

  // do something when app is closing
  process.on('exit', exitHandler.bind(null, { cleanup: true }));

  // catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, { exit: true }));

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, { exit: true }));
  process.on('SIGUSR2', exitHandler.bind(null, { exit: true }));

  // catches uncaught exceptions
  process.on('uncaughtException', exitHandler.bind(null, { exit: true }));
  cliAskQuestion();
  twitchClient = new tmi.Client({
    connection: {
      reconnect: true
    },
    identity: config.identity,
    channels: Object.keys(config.channels)
  });

  twitchClient.connect();
  if (!config.useChannelPoints) {
    twitchClient.on('message', (channel, tags, message, self) => {
      if (tags.username === config.botUsername) {
        return;
      }
      if (message.match(regexpCommand) != null) {
        const [raw, userCommand, argument] = message.match(regexpCommand);
        if (userCommand) {
          executeCommand(tags.username, userCommand, argument, channel, TWITCH_PLATFORM)
        }
        else {
          console.log(`${tags['display-name']}: ${message}`);
          WriteToLog(JSON.stringify({ "commandType": MESSAGE_COMMAND_TYPE, "body": `${tags['display-name']}: ${message}` }));
        }
      }
      else {
        console.log(`${tags['display-name']}: ${message}`);
        WriteToLog(JSON.stringify({ "commandType": MESSAGE_COMMAND_TYPE, "body": `${tags['display-name']}: ${message}` }));
      }
    });

    twitchClient.on('message', (channel, tags, message, self) => {
      if (tags.username === config.botUsername) {
        return;
      }
      if (message.match(regexpCommand) != null) {
        const [raw, userCommand, argument] = message.match(regexpCommand);
        if (userCommand) {
          executeCommand(tags.username, userCommand, argument, channel, TWITCH_PLATFORM)
        }
        else {
          console.log(`${tags['display-name']}: ${message}`);
          //WriteToLog(JSON.stringify({ "commandType": MESSAGE_COMMAND_TYPE, "body": `${tags['display-name']}: ${message}` }));
        }
      }
      else {
        console.log(`${tags['display-name']}: ${message}`);
        //WriteToLog(JSON.stringify({ "commandType": MESSAGE_COMMAND_TYPE, "body": `${tags['display-name']}: ${message}` }));
      }
    });
  }
};
init();
