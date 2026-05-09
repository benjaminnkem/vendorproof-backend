import { QueueEvents } from "bullmq";
import { QueueNames } from "../../@types";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";

export const smsQueueEvents = new QueueEvents(QueueNames.SEND_SMS, {
  connection: redisConnection,
});

export const registerSmsQueueEvents = () => {
  smsQueueEvents.on("active", ({ jobId, prev }) => {
    logger.info(
      `[SMS_QUEUE] job ${jobId} is now active (previous state: ${prev ?? "unknown"})`,
    );
  });

  smsQueueEvents.on("completed", ({ jobId }) => {
    logger.info(`[SMS_QUEUE] job ${jobId} completed successfully`);
  });

  smsQueueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error(`[SMS_QUEUE] job ${jobId} failed: ${failedReason}`);
  });

  smsQueueEvents.on("stalled", ({ jobId }) => {
    logger.warn(`[SMS_QUEUE] job ${jobId} stalled and will be retried`);
  });
};
