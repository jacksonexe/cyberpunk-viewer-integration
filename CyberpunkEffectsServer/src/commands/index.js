import { ALLOWED_IN_GAME_QUICK_HACKS, ALLOWED_IN_GAME_STATUS_EFFECTS, IN_GAME_EFFECTS } from "../effects/index.js";
import { LOCAL_PLATFORM } from "../utils/constants.js";
import config from "../../config/config.json" with { type: "json" };

export const ALL_COMMANDS = {
    "newchoom": {
      "execute": (username, channel, params, platform, config, logger, databaseManager, platformManager, effectManager) => { databaseManager.signUpUser(username, channel, params, platform) },
      "disableOnChannelPoints": true,
      "help": `Signs you up to gain points to spend on effects. You gain ${config.pointsPerInterval} points per ${config.interval / 1000} seconds.`
    },
    "givepoints": {
      "execute": (username, channel, params, platform, config, logger, databaseManager, platformManager, effectManager) => { databaseManager.giveUserPoints(username, channel, params, platform) },
      "help": `Gives points to specified user, takes username and gives 1000 points.`,
      "allowedPlatforms": [LOCAL_PLATFORM],
      "hasParams": true,
      "parseParams": (param) => param
    },
    "refundEvent": {
      "execute":  (username, channel, params, platform, config, logger, databaseManager, platformManager, effectManager) => { databaseManager.refundUser(username, channel, params, platform) },
      "help": `Refunds an event to the user, takes event id.`,
      "disableOnChannelPoints": true,
      "allowedPlatforms": [LOCAL_PLATFORM],
      "hasParams": true,
      "parseParams": (param) => param
    },
    "balance": {
      "execute": (username, channel, params, platform, config, logger, databaseManager, platformManager, effectManager) => { databaseManager.checkBalance(username, channel, params, platform) },
      "help": "Check how many points you currently have.",
      "disableOnChannelPoints": true,
    },
    "addmoney": {
      "help": "Add money from the player whose point cost is 1/4 the amount of money.",
      "hasParams": true,
      "parseParams": (param) => {
        return Number.parseInt(param);
      }
    },
    "takemoney": {
      "help": "Removes money from the player whose point cost is 1/4 the amount of money.",
      "hasParams": true,
      "parseParams": (param) => {
        return Number.parseInt(param);
      }
    },
    "wanted": {
      "hasParams": true,
      "parseParams": (param) => {
        return Number.parseInt(param);
      },
      "help" : "Gives the player a wanted level, valid values are 1-5"
    },
    "quickhack": {
      "help": `Lets you quick hack the player. Allowed values and cost ${Object.keys(ALLOWED_IN_GAME_QUICK_HACKS).map((status) => `${status}: ${ALLOWED_IN_GAME_QUICK_HACKS[status].cost} points`).join(", ")}`,
      "hasParams": true,
      "parseParams": (param) => {
        const allowedHacks = Object.keys(ALLOWED_IN_GAME_QUICK_HACKS);
        if (allowedHacks.find((p) => p === param) === undefined) {
          throw new Error(`not a valid quick hack, only ${allowedHacks.join(", ")} are allowed.`)
        }
        return param;
      }
    },
    "statuseffect": {
      "help": `Gives the player a status effect for ${IN_GAME_EFFECTS.statuseffect.duration} seconds.Allowed values and cost ${Object.keys(ALLOWED_IN_GAME_STATUS_EFFECTS).map((status) => `${status}: ${ALLOWED_IN_GAME_STATUS_EFFECTS[status].cost} points`).join(", ")}`,
      "hasParams": true,
      "parseParams": (param) => {
        const statusEffects = Object.keys(ALLOWED_IN_GAME_STATUS_EFFECTS);
        if (statusEffects.find((p) => p === param) === undefined) {
          throw new Error(`not a valid status effect, only ${statusEffects.join(", ")} are allowed.`)
        }
        return param;
      }
    },
    "killplayer": {
      "help": `kills player for ${IN_GAME_EFFECTS.killplayer.cost} points`
    },
    "upsidedown": {
      "help": `Flips the players camera for ${IN_GAME_EFFECTS.upsidedown.cost} points`
    },
    "doomvision": {
      "help": `Gives the player doom vision for ${IN_GAME_EFFECTS.doomvision.duration} seconds for ${IN_GAME_EFFECTS.doomvision.cost} points`
    },
    "preyvision": {
      "help": `Gives the player prey vision for ${IN_GAME_EFFECTS.preyvision.duration} seconds for ${IN_GAME_EFFECTS.preyvision.cost} points`
    },
    "smashing": {
      "help": `The man the myth the legend for ${IN_GAME_EFFECTS.smashing.cost} points`
    },
    "kurt": {
      "help": `The other legend for ${IN_GAME_EFFECTS.kurt.cost} points`
    },
    "slowdown": {
      "help": `Have the player enter slow mo for ${IN_GAME_EFFECTS.slowdown.cost} points`
    },
    "speedup": {
      "help": `Have the player go fast for ${IN_GAME_EFFECTS.speedup.cost} points`
    },
    "carpocolypse": {
      "help": `All cars around go boom for ${IN_GAME_EFFECTS.carpocolypse.cost} points`
    },
    "carsbepopin": {
      "help": `All tires around go boom for ${IN_GAME_EFFECTS.carsbepopin.cost} points`
    },
    "tankrain": {
      "help": `Its raining tanks for ${IN_GAME_EFFECTS.tankrain.cost}`
    },
    "dropweapons": {
      "help": `Forces the player to drop all weapons for ${IN_GAME_EFFECTS.dropweapons.cost}`
    },
    "forceweapon": {
      "help": `Everyone loves budget fire arms for ${IN_GAME_EFFECTS.dropweapons.cost}`
    },
    "onehit": {
      "help": `Puts the player at 1 hp for ${IN_GAME_EFFECTS.onehit.cost}`
    },
    "heal": {
      "help": `Heals the player to full for ${IN_GAME_EFFECTS.heal.cost}`
    },
    "refillammo": {
      "help": `Refills all the players ammo for ${IN_GAME_EFFECTS.refillammo.cost}`
    },
    "removeammo": {
      "help": `Removes all the players ammo for ${IN_GAME_EFFECTS.removeammo.cost}`
    },
    "infiniteammo": {
      "help": `Gives the player infinite ammo for ${IN_GAME_EFFECTS.infiniteammo.cost} for ${IN_GAME_EFFECTS.infiniteammo.duration} seconds`
    },
    "immortal": {
      "help": `Toggles god mode for ${IN_GAME_EFFECTS.immortal.cost} for ${IN_GAME_EFFECTS.immortal.duration} seconds`
    }
  }