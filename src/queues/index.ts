import { closeKycQueue } from "./kyc";

export * from "./kyc";

export const closeAllQueues = async () => {
  await closeKycQueue();
};
