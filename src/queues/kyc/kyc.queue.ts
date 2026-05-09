import { JobsOptions, Queue } from "bullmq";
import { QueueNames, KycVerificationJobPayload } from "../../@types";
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

export const kycQueue = new Queue<KycVerificationJobPayload>(
  QueueNames.KYC_VERIFICATION,
  {
    connection: redisConnection,
    defaultJobOptions,
  },
);

export const enqueueKycVerificationJob = async (
  payload: KycVerificationJobPayload,
) => {
  return kycQueue.add(QueueNames.KYC_VERIFICATION, payload);
};
