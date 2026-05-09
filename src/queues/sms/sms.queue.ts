import { JobsOptions, Queue } from "bullmq";
import { QueueNames } from "../../@types";
import { redisConnection } from "../../config/redis";
import { SendSmsRequest } from "../../infra/sms-gate/types";

const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 2_000,
  },
  removeOnComplete: 100,
  removeOnFail: 200,
};

export const smsQueue = new Queue<SendSmsRequest>(QueueNames.SEND_SMS, {
  connection: redisConnection,
  defaultJobOptions,
});

export const enqueueSmsJob = async (payload: SendSmsRequest) => {
  return smsQueue.add(QueueNames.SEND_SMS, payload);
};
