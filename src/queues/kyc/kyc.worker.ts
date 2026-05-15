import { Worker } from "bullmq";
import { KycVerificationJobPayload, QueueNames } from "../../@types";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";
import { processBusinessKycVerificationJob } from "../../services/kyc.service";

export const kycWorker = new Worker<KycVerificationJobPayload>(
  QueueNames.KYC_VERIFICATION,
  async (job) => {
    try {
      logger.info(
        `[KYC_QUEUE] Processing job ${job.id} for business ${job.data.businessId}`,
      );
      return processBusinessKycVerificationJob(job.data);
    } catch (error) {
      console.log(error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 1,
  },
);

kycWorker.on("error", (error) => {
  logger.error("[KYC_QUEUE] Worker error", error);
});
