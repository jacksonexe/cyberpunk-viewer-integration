import { ALL_COMMANDS } from "../commands/index.js";
import { DatabaseManager } from "../db/index.js";
import { EffectManager } from "../effects/index.js";
import { LOCAL_PLATFORM } from "../utils/constants.js";
import { LocalConsoleManager } from "./local.js";
import { TwitchManager } from "./twitch.js";

export class PlatformManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger.child({ "source": "PlatformManager" });
        this.twitchClient = new TwitchManager(config, this.logger);
        this.cliClient = new LocalConsoleManager(config, this.logger);
        this.databaseManager = new DatabaseManager(config, this.logger, this);
        this.effectManager = new EffectManager(this.databaseManager, this, config, this.logger);
        this.executeCommand = this.executeCommand.bind(this)
    }

    sendMessageViaPlatform(platform, username, channel, message) {
        if (platform === LOCAL_PLATFORM) {
            this.cliClient.log(message);
        }
        else if (platform === TWITCH_PLATFORM) {
            this.twitchClient.say(channel, message);
        }
    }

    async init() {
        await this.twitchClient.initClient(this.executeCommand, this.effectManager, this.databaseManager, this);
        this.cliClient.initClient(this.executeCommand, this.effectManager);
    }

    executeCommand(username, userCommand, argument, channel, platform) {
        this.logger.debug(userCommand);
        let found = false;
        const me = this;
        const keys = Object.keys(ALL_COMMANDS);
        for (var key in keys) {
            const command = keys[key];
            const commandConfig = ALL_COMMANDS[command];
            if (userCommand === command && !commandConfig.isDisabled && (!this.config.useChannelPoints || (!commandConfig.disableOnChannelPoints)) && (commandConfig.allowedPlatforms === undefined || commandConfig.allowedPlatforms.find((plat) => plat === platform) !== undefined)) {
                let params = undefined;
                if(commandConfig.execute){
                    execute = commandConfig.execute;
                }
                if (typeof argument === 'string' && argument.toLowerCase() === "help") {
                    me.sendMessageViaPlatform(platform, username, channel, `@${username} ${commandConfig.help}`);
                    return
                }
                if (commandConfig.hasParams) {
                    params = argument;
                    if (commandConfig.parseParams !== undefined) {

                        try {
                            params = commandConfig.parseParams(params);
                        }
                        catch (e) {
                            console.error(e);
                            me.sendMessageViaPlatform(platform, username, channel, `@${username} an invalid paramater, help: ${commandConfig.help}`);
                            return;
                        }
                    }

                    if(params === undefined || params === "" || (typeof params === 'string' && params.length === 0) || (isNaN(params) && (typeof params !== 'string' || params.length <= 3))){
                        me.sendMessageViaPlatform(platform, username, channel, `@${username} a paramater is required, help: ${commandConfig.help}`);
                        return;
                    }
                }
                if(commandConfig.execute){
                    commandConfig.execute(username, channel, params, platform, me.config, me.logger, me.databaseManager, me.platformManager, me);
                }
                else{
                    me.effectManager.sendEffect(command, username, channel, argument, platform)
                }
                found = true;
                break;
            }
        }
        if (!found) {
            if (userCommand === "commandlist" || userCommand === "help") {
                const commandList = [];
                for (var key in keys) {
                    const command = keys[key];
                    const commandConfig = ALL_COMMANDS[command];
                    if (!commandConfig.isDisabled && (!this.config.useChannelPoints || (!commandConfig.disableOnChannelPoints)) && (commandConfig.allowedPlatforms === undefined || commandConfig.allowedPlatforms.find((plat) => plat === platform) !== undefined))
                        commandList.push("!" + command);
                }
                this.sendMessageViaPlatform(platform, username, channel, `@${username} !The list of commands are: ${commandList.join(", ")}. Type <command> help to get the details about the command.`);
            }
        }
    }

    async start(){
        await this.twitchClient.start();
        this.cliClient.start();
    }

    async stop() {
        await this.twitchClient.stop();
        this.cliClient.stop();
        this.databaseManager.stop();
    }
}