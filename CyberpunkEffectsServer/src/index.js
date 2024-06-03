import config from "../config/config.json" with { type: "json" };
import pino from 'pino';

import { DatabaseManager } from "./db/index.js";
import { PlatformManager } from "./platform/index.js";

const fileTransport = pino.transport({
  target: 'pino/file',
  options: { destination: `./app.log` },
});

const logger = pino(
  {
    level: config.logLevel || 'debug',
    formatters: {
      level: (label) => {
        return { level: label.toUpperCase() };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  fileTransport
);

const init = async () => {
  const platformManager = new PlatformManager(config, logger);
  const dbManager = new DatabaseManager(config, logger, platformManager);
  //dbManager.clearDB();
  if(!config.useChannelPoints){
    dbManager.initDB();
  }
  await platformManager.init();
  await platformManager.start();

  process.stdin.resume(); // so the program will not close instantly
  
  const exitHandler = async (options, exitCode) => {
    dbManager.stop();
    await platformManager.stop();

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
};
init();
