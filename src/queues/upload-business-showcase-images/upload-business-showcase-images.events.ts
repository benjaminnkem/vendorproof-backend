import { QueueEvents } from "bullmq";
import { QueueNames } from "../../@types";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";

export const uploadBusinessShowCaseImagesQueueEvents = new QueueEvents(
  QueueNames.UPLOAD_BUSINESS_SHOWCASE_IMAGES,
  {
    connection: redisConnection,
  },
);

export const registerUploadBusinessShowCaseImagesQueueEvents = () => {
  uploadBusinessShowCaseImagesQueueEvents.on("active", ({ jobId, prev }) => {
    logger.info(
      `[BUSINESS_SHOWCASE_QUEUE] job ${jobId} is now active (previous state: ${prev ?? "unknown"})`,
    );
  });

  uploadBusinessShowCaseImagesQueueEvents.on("completed", ({ jobId }) => {
    logger.info(
      `[BUSINESS_SHOWCASE_QUEUE] job ${jobId} completed successfully`,
    );
  });

  uploadBusinessShowCaseImagesQueueEvents.on(
    "failed",
    ({ jobId, failedReason }) => {
      logger.error(
        `[BUSINESS_SHOWCASE_QUEUE] job ${jobId} failed: ${failedReason}`,
      );
    },
  );

  uploadBusinessShowCaseImagesQueueEvents.on("stalled", ({ jobId }) => {
    logger.warn(
      `[BUSINESS_SHOWCASE_QUEUE] job ${jobId} stalled and will be retried`,
    );
  });
};
