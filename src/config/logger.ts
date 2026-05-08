import boxen from "boxen";
import chalk from "chalk";
import log4js from "log4js";
import figlet from "figlet";

class Logger {
  private logger: log4js.Logger;

  constructor() {
    log4js.configure({
      appenders: {
        console: { type: "console" },
        file: { type: "file", filename: "logs/app.log" },
      },
      categories: {
        default: { appenders: ["console", "file"], level: "info" },
      },
    });

    this.logger = log4js.getLogger();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info(message: string, ...args: any[]) {
    this.logger.info(chalk.green(message, ...args));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error(message: string, ...args: any[]) {
    this.logger.error(chalk.red(message, ...args));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn(message: string, ...args: any[]) {
    this.logger.warn(chalk.yellow(message, ...args));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug(message: string, ...args: any[]) {
    this.logger.debug(message, ...args);
  }

  logBrand() {
    const brand = `VendorProof API`;

    console.log(
      chalk.blue.bold(
        boxen(
          figlet.textSync(brand, {
            font: "Standard",
          }),
          {
            padding: 1,
            borderColor: "blue",
            borderStyle: "round",
          },
        ),
      ),
    );
  }
}

declare global {
  var globalLogger: Logger | null;
}

if (!globalThis.globalLogger) {
  globalThis.globalLogger = new Logger();
}

export const logger = globalThis.globalLogger as Logger;
