import { JobsOptions, Queue } from "bullmq";
import {
  QueueNames,
  UploadBusinessShowCaseImagesJobPayload,
} from "../../@types";
import { redisConnection } from "../../config/redis";

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2_000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export const uploadBusinessShowCaseImagesQueue =
  new Queue<UploadBusinessShowCaseImagesJobPayload>(
    QueueNames.UPLOAD_BUSINESS_SHOWCASE_IMAGES,
    {
      connection: redisConnection,
      defaultJobOptions,
    },
  );

export const enqueueUploadBusinessShowCaseImagesJob = async (
  payload: UploadBusinessShowCaseImagesJobPayload,
) => {
  return uploadBusinessShowCaseImagesQueue.add(
    QueueNames.UPLOAD_BUSINESS_SHOWCASE_IMAGES,
    payload,
  );
};
