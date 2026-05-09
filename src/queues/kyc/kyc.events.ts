import { QueueEvents } from "bullmq";
import { QueueNames } from "../../@types";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";

export const kycQueueEvents = new QueueEvents(QueueNames.KYC_VERIFICATION, {
  connection: redisConnection,
});

export const registerKycQueueEvents = () => {
  kycQueueEvents.on("active", ({ jobId, prev }) => {
    logger.info(
      `[KYC_QUEUE] job ${jobId} is now active (previous state: ${prev ?? "unknown"})`,
    );
  });

  kycQueueEvents.on("completed", ({ jobId }) => {
    logger.info(`[KYC_QUEUE] job ${jobId} completed successfully`);
  });

  kycQueueEvents.on("failed", ({ jobId, failedReason }) => {
    logger.error(`[KYC_QUEUE] job ${jobId} failed: ${failedReason}`);
  });

  kycQueueEvents.on("stalled", ({ jobId }) => {
    logger.warn(`[KYC_QUEUE] job ${jobId} stalled and will be retried`);
  });
};
