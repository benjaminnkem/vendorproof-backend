import {
  uploadBusinessShowCaseImagesQueueEvents,
  registerUploadBusinessShowCaseImagesQueueEvents,
} from "./upload-business-showcase-images.events";
import { uploadBusinessShowCaseImagesQueue } from "./upload-business-showcase-images.queue";
import { uploadBusinessShowCaseImagesWorker } from "./upload-business-showcase-images.worker";

export const closeUploadBusinessShowCaseImagesQueue = async () => {
  await uploadBusinessShowCaseImagesWorker.close();
  await uploadBusinessShowCaseImagesQueue.close();
  await uploadBusinessShowCaseImagesQueueEvents.close();
};

const bootstrapUploadBusinessShowCaseImagesQueue = async () => {
  registerUploadBusinessShowCaseImagesQueueEvents();
  await uploadBusinessShowCaseImagesWorker.waitUntilReady();
};

bootstrapUploadBusinessShowCaseImagesQueue().catch((error) => {
  console.error(
    "Error initializing upload business showcase images queue:",
    error,
  );
  process.exit(1);
});
