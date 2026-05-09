import { closeKycQueue } from "./kyc";
import { closeSmsQueue } from "./sms";

export * from "./kyc";
export * from "./sms";

export const closeAllQueues = async () => {
  await closeKycQueue();
  await closeSmsQueue();
};
