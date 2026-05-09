import { smsQueueEvents, registerSmsQueueEvents } from "./sms.events";
import { smsQueue } from "./sms.queue";
import { smsWorker } from "./sms.worker";

export const closeSmsQueue = async () => {
  await smsWorker.close();
  await smsQueue.close();
  await smsQueueEvents.close();
};

const bootstrapSmsQueue = async () => {
  registerSmsQueueEvents();
  await smsWorker.waitUntilReady();
};

bootstrapSmsQueue().catch((error) => {
  console.error("Error initializing SMS queue:", error);
  process.exit(1);
});
