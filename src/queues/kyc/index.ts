import { kycQueueEvents, registerKycQueueEvents } from "./kyc.events";
import { kycQueue } from "./kyc.queue";
import { kycWorker } from "./kyc.worker";

export const closeKycQueue = async () => {
  await kycWorker.close();
  await kycQueue.close();
  await kycQueueEvents.close();
};

const bootstrapKycQueue = async () => {
  registerKycQueueEvents();
  await kycWorker.waitUntilReady();
};

bootstrapKycQueue().catch((error) => {
  console.error("Error initializing KYC queue:", error);
  process.exit(1);
});
