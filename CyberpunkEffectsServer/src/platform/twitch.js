import { ALL_COMMANDS } from '../commands/index.js';
import { IN_GAME_EFFECTS } from '../effects/index.js';
import { COMMAND_REGEX, TWITCH_PLATFORM } from '../utils/constants.js';
import { StaticAuthProvider } from '@twurple/auth';
import { PubSubClient } from '@twurple/pubsub';
import { ApiClient } from '@twurple/api';


import tmi from 'tmi.js';

export class TwitchManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger.child({ "source": "TwitchManager" });
    }

    async initClient(executeCommand, effectManager, databaseManager, platformManager) {
        this.twitchClient = new tmi.Client({
            connection: {
                reconnect: true
            },
            identity: this.config.identity,
            channels: Object.keys(this.config.channels)
        });


        this.channelPointListener = [];
        if (this.config.useChannelPoints) {
            this.authProvider = new StaticAuthProvider(this.config.twitchCredentials.clientId, this.config.twitchCredentials.clientSecret, ['channel:read:redemptions', 'channel:manage:redemptions']);
            this.apiClient = new ApiClient({
                authProvider: this.authProvider, logger: {
                    minLevel: 'debug'
                }
            });

            const pubSubClient = new PubSubClient({ authProvider: this.authProvider });
            const me = this;
            await Object.keys(this.config.channels).forEach(async (channel) => {
                me.logger.info(`Creating channel point listener for ${channel}`);
                const user = await me.apiClient.users.getUserByName(channel);
                if (me.config.createChannelPointRewards) {
                    await me.createChannelPointRewards(user);
                }
                const channelConfig = me.config.channels[channel];
                const handler = pubSubClient.onRedemption(channelConfig.channelId, async (message) => {
                    const reward = message.rewardTitle.toLowerCase().replace(/ /g, "");
                    const commandConfig = ALL_COMMANDS[reward];
                    if (reward !== undefined && message.rewardIsQueued && commandConfig !== undefined && !commandConfig.isDisabled && (!me.config.useChannelPoints || (!commandConfig.disableOnChannelPoints)) && (commandConfig.allowedPlatforms === undefined || commandConfig.allowedPlatforms.find((plat) => plat === TWITCH_PLATFORM) !== undefined)) {
                        let params = undefined;
                        me.logger.debug(message.message);
                        if (commandConfig.hasParams) {
                            if (message.message === undefined || message.message === "") {
                                me.twitchClient.say(channelConfig.channelName, `@${message.userName} you have to enter values for ${message.rewardTitle}`);
                                me.apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "CANCELED");
                            }
                            params = message.message;
                            if (commandConfig.parseParams !== undefined) {
                                try {
                                    params = commandConfig.parseParams(params);
                                }
                                catch (e) {
                                    me.logger.error(e);
                                    me.twitchClient.say(channelConfig.channelName, `@${message.userName} you have entered invalid values for ${message.rewardTitle}`);
                                    me.apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "CANCELED");
                                    return;
                                }
                            }
                        }
                        if(commandConfig.execute){
                            commandConfig.execute(message.userName, channelConfig.channelName, params, TWITCH_PLATFORM, me.config, me.logger, databaseManager, platformManager, effectManager);
                        }
                        else{
                            effectManager.sendEffect(reward, message.userName, channelConfig.channelName, params, TWITCH_PLATFORM)
                        }
                        //me.apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "FULFILLED");
                    }
                    else {
                        me.twitchClient.say(channelConfig.channelName, `@${channelConfig.channelName} oh no, looks like channel point reward ${message.rewardTitle} is not a valid command, bad streamer.`);
                        me.apiClient.channelPoints.updateRedemptionStatusByIds(user, message.rewardId, [message.id], "CANCELED");
                    }
                })
                me.channelPointListener.push(handler);
            })
        }
        return this.twitchClient.connect();
    }

    async createChannelPointRewards(broadcaster) {
        const me = this;
        await Object.keys(IN_GAME_EFFECTS).forEach(async (effect) => {
            try{
                const commandCfg = ALL_COMMANDS[effect];
                if (commandCfg !== undefined && !commandCfg.isDisabled && (!me.config.useChannelPoints || (!commandCfg.disableOnChannelPoints)) && (commandCfg.allowedPlatforms === undefined || commandCfg.allowedPlatforms.find((plat) => plat === TWITCH_PLATFORM) !== undefined)) {
                    const effectConfig = IN_GAME_EFFECTS[effect];
                    let cost = effectConfig.cost;
                    if (effectConfig.calculatedCost !== undefined) {
                        if (effect === "statuseffect") {
                            cost = effectConfig.calculatedCost("drunk");
                        }
                        else if (effect === "quickhack") {
                            cost = effectConfig.calculatedCost("disable-cyberware");
                        }
                        else if (effectConfig.max !== undefined) {
                            cost = effectConfig.calculatedCost(effectConfig.max);
                        }
                        else {
                            cost = effectConfig.calculatedCost();
                        }
                    }
                    const color = '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
                    let cooldown = 60;
                    if (cost >= 5000) {
                        cooldown = 300;
                    }
                    cost = Math.floor(cost / 5); //To make this affordable
                    if (cost <= 0) {
                        cost = 100;
                    }
                    const data = { cost, title: effect, isEnabled: true, userInputRequired: commandCfg.hasParams, prompt: commandCfg.help, backgroundColor: color, globalCooldown: cooldown };
                    me.logger.debug(`creating reward ${effect}\n${JSON.stringify(data, null, 4)}`);
                    await me.apiClient.channelPoints.createCustomReward(broadcaster, data);
                }
            }
            catch(e){
                me.logger.error(e)
            }
        })

    }

    start(executeCommand) {
        const me = this;
        this.twitchClient.on('message', (channel, tags, message, self) => {
            if (tags.username === me.config.botUsername) {
                return;
            }
            if (message.match(COMMAND_REGEX) != null) {
                const [raw, userCommand, argument] = message.match(COMMAND_REGEX);
                if (userCommand) {
                    executeCommand(tags.username, userCommand, argument, channel, TWITCH_PLATFORM);
                }
                else {
                    me.logger.debug(`${tags['display-name']}: ${message}`);
                    //WriteToLog(JSON.stringify({ "commandType": MESSAGE_COMMAND_TYPE, "body": `${tags['display-name']}: ${message}` }));
                }
            }
            else {
                me.logger.debug(`${tags['display-name']}: ${message}`);
                //WriteToLog(JSON.stringify({ "commandType": MESSAGE_COMMAND_TYPE, "body": `${tags['display-name']}: ${message}` }));
            }
        });
    }

    async stop() {
        for (let client of this.channelPointListener) {
            client.remove();
        }

        if (!this.config.useChannelPoints) {
            await this.db.close();
        }
    }

    async say(channel, message) {
        await this.twitchClient.say(channel, message);
    }
}