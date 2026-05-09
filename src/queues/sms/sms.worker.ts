import { Worker } from "bullmq";
import { QueueNames } from "../../@types";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";
import smsGateService from "../../infra/sms-gate/http-service";
import { SendSmsRequest } from "../../infra/sms-gate/types";

export const smsWorker = new Worker<SendSmsRequest>(
  QueueNames.SEND_SMS,
  async (job) => {
    try {
      logger.info(
        `[SMS_QUEUE] Processing job ${job.id} for sending sms to ${job.data.to.join(", ")}`,
      );
      return await smsGateService.sendSms(job.data);
    } catch (error) {
      console.log(error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  },
);

smsWorker.on("error", (error) => {
  logger.error("[SMS_QUEUE] Worker error", error);
});
