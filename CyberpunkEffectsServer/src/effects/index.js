import { WriteToLog } from '../utils/index.js';

export const ALLOWED_IN_GAME_QUICK_HACKS = {
    "short-circuit": { 
      "cost": 100
    },
    "overheat": {
      "cost": 100
    },
    "reboot-optics": {
      "cost": 100
    },
    "disable-cyberware": {
      "cost": 200
    },
    "cripple-movement": {
      "cost": 200
    },
    "weapon-glitch": {
      "cost": 100
    }
  }
  
export const ALLOWED_IN_GAME_STATUS_EFFECTS = {
    "frozen": {
      "cost": 200
    },
    "bleeding": {
      "cost": 100
    },
    "drunk": {
      "cost": 100
    }
  }
  
export const IN_GAME_EFFECTS = {
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
        return ALLOWED_IN_GAME_QUICK_HACKS[level].cost;
      }
    },
    "statuseffect": {
      "effectType": "statuseffect",
      "duration": 30,
      "calculatedCost": (level) => {
        return ALLOWED_IN_GAME_STATUS_EFFECTS[level].cost;
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

export class EffectManager {

    constructor(databaseManager, platformManager, config, logger){
        this.logger = logger.child({"source" : "EffectManager"});
        this.databaseManager = databaseManager;
        this.platformManager = platformManager;
        this.config = config;
        this.sendEffect = this.sendEffect.bind(this);
    }

    sendEffect(effect, username, channel, amount, platform){
        this.logger.debug(`Executing effect ${effect} from user ${username} in channel ${channel}`)
        const effectConfig = IN_GAME_EFFECTS[effect];
        const me = this;
        const applyEffect = (user) => {
            if (effectConfig.min !== undefined && (amount < effectConfig.min || Number.isNaN(amount))) {
                me.platformManager.sendMessageViaPlatform(platform, username, channel, `@${username} amount specified is either not a number or too low`);
                return;
            }
            if (effectConfig.max !== undefined && (amount > effectConfig.max || Number.isNaN(amount))) {
                me.platformManager.sendMessageViaPlatform(platform, username, channel, `@${username} amount specified is either not a number or too high`);
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
            const points = me.databaseManager.getPoints(user);
            if (points >= cost) {
                me.databaseManager.setPoints(username, points - cost);
                me.databaseManager.writeEventLog(username, effect, cost, platform, channel);
                WriteToLog(JSON.stringify(data), me.config, me.logger);
            }
            else {
                me.platformManager.sendMessageViaPlatform(platform, username, channel, `@${username} you don't have enough, need ${cost} but you have ${points}`)
            }
        };
        if (me.config.useChannelPoints) {
            applyEffect();
        }
        else {
            me.databaseManager.getUser((user) => {
                if (user["is_disabled"]) {
                    return;
                }
                applyEffect(user);
            });
            
        }
    
    }
}