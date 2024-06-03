import fs from 'node:fs';
export const WriteToLog = (content, config, logger) => {
    const pathToCP = config.cyberpunkModPath;
    fs.appendFile(pathToCP + '/currentLogs.log', content + "\n", err => {
      if (err) {
        logger.error(err);
      } else {
        // done!
      }
    });
  }