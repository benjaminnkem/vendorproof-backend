import RedisClient from "ioredis";
import { env } from "./env";
import chalk from "chalk";

declare global {
  // allow global `var` declarations
  var globalRedis: RedisClient | null;
}

const redisClient = new RedisClient(env.REDIS_CONNECTION_STRING, {
  maxRetriesPerRequest: null,
});

if (!globalThis.globalRedis) {
  globalThis.globalRedis = redisClient;

  globalThis.globalRedis.on("connect", () => {
    console.log(chalk.green("Successfully connected to Redis."));
  });

  globalThis.globalRedis.on("error", (err) => {
    console.error(chalk.red("Failed to connect to Redis:"), err);
    process.exit(1);
  });
}

export const testCacheConnection = async (): Promise<boolean> => {
  try {
    await globalThis.globalRedis?.ping();
    return true;
  } catch (err) {
    console.error(chalk.red("Redis connection test failed:"), err);
    return false;
  }
};

export const closeCacheConnection = async (): Promise<void> => {
  try {
    await globalThis.globalRedis?.quit();
    console.log(chalk.green("Redis connection closed successfully."));
  } catch (err) {
    console.error(chalk.red("Failed to close Redis connection:"), err);
  }
};

export const redisConnection = globalThis.globalRedis as RedisClient;

export const redis = globalThis.globalRedis as RedisClient;
