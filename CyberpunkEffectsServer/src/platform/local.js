import { LOCAL_PLATFORM } from '../utils/constants.js';
import readline from 'node:readline';

export class LocalConsoleManager {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger.child({ "source": "LocalConsoleManager" });;
        this.serverCLI = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    log(message) {
        console.log(message);
    }

    initClient(executeCommand) {
        const me = this;
        this.cliAskQuestion = () => {
            me.serverCLI.question(`Enter Command  `, cmd => {
                const [command, args] = cmd.split(" ");
                let finalCommand = command;
                if (command.startsWith("!")) {
                    finalCommand = command.substring(1);
                }
                executeCommand("local", finalCommand, args, LOCAL_PLATFORM, LOCAL_PLATFORM);
                me.cliAskQuestion();
            });
        }
    }

    async start(){
        this.cliAskQuestion();
    }

    async stop(){
        await serverCLI.close();
    }
}