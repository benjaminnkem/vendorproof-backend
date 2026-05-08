import app from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";

const initServer = async () => {
  try {
    app.listen(env.PORT, () => {
      logger.logBrand();

      logger.info(
        `Server is running on port ${env.PORT} in ${env.NODE_ENV} mode.`,
      );

      process.on("unhandledRejection", (reason, promise) => {
        logger.error("Unhandled Rejection at:", promise, "reason:", reason);
        process.exit(1);
      });

      process.on("uncaughtException", (error) => {
        logger.error("Uncaught Exception:", error);
        process.exit(1);
      });

      process.on("SIGINT", () => {
        logger.info("Gracefully shutting down...");
        process.exit(0);
      });

      process.on("SIGTERM", () => {
        logger.info("Gracefully shutting down...");
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error("Failed to start the server:", error);
    process.exit(1);
  }
};

initServer();
