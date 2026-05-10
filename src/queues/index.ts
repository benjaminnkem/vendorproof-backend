import { closeKycQueue } from "./kyc";
import { closeSmsQueue } from "./sms";
import { closeUploadBusinessShowCaseImagesQueue } from "./upload-business-showcase-images";

export * from "./kyc";
export * from "./sms";
export * from "./upload-business-showcase-images";

export const closeAllQueues = async () => {
  await closeKycQueue();
  await closeSmsQueue();
  await closeUploadBusinessShowCaseImagesQueue();
};
