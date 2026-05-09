import app from "./app";
import { closeDbConnection } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { closeCacheConnection } from "./config/redis";

import { closeAllQueues } from "./queues";

const closeServer = async () => {
  logger.info("Shutting down server...");
  await closeAllQueues();
  await closeDbConnection();
  await closeCacheConnection();

  logger.info("Server shutdown complete.");

  process.exit(0);
};

const initServer = async () => {
  try {
    app.listen(env.PORT, () => {
      logger.logBrand();

      logger.info(
        `Server is running on port ${env.PORT} in ${env.NODE_ENV} mode.`,
      );

      process.on("unhandledRejection", (reason, promise) => {
        console.log(promise, reason);
        logger.error("Unhandled Rejection at:", promise, "reason:", reason);
        process.exit(1);
      });

      process.on("uncaughtException", (error) => {
        logger.error("Uncaught Exception:", error);
        process.exit(1);
      });

      process.on("SIGINT", closeServer);

      process.on("SIGTERM", closeServer);
    });
  } catch (error) {
    logger.error("Failed to start the server:", error);
    process.exit(1);
  }
};

initServer();
