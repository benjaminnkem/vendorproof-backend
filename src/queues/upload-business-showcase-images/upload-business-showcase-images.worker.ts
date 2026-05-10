import { Worker } from "bullmq";
import {
  QueueFilePayload,
  QueueNames,
  UploadBusinessShowCaseImagesJobPayload,
} from "../../@types";
import { redisConnection } from "../../config/redis";
import { logger } from "../../config/logger";
import { prisma } from "../../config/db";
import cloudinaryHttpService from "../../infra/cloudinary/http-service";

const toCloudinaryFile = (file: QueueFilePayload) => {
  return {
    buffer: Buffer.from(file.bufferBase64, "base64"),
    mimetype: file.mimetype,
    originalname: file.originalname,
  };
};

export const processUploadBusinessShowCaseImagesJob = async (
  payload: UploadBusinessShowCaseImagesJobPayload,
) => {
  const uploadedImageUrls = await Promise.all(
    payload.files.map(async (file) => {
      const uploadedFile = await cloudinaryHttpService.uploadFile({
        file: toCloudinaryFile(file),
        folder: payload.folder,
        resourceType: "image",
      });

      return uploadedFile.url;
    }),
  );

  await prisma.business.update({
    where: {
      id: payload.businessId,
    },
    data: {
      showCaseImages: uploadedImageUrls,
    },
  });

  logger.info(
    `[BUSINESS_SHOWCASE_QUEUE] Uploaded ${uploadedImageUrls.length} image(s) for business ${payload.businessId}`,
  );

  return {
    businessId: payload.businessId,
    uploadedCount: uploadedImageUrls.length,
  };
};

export const uploadBusinessShowCaseImagesWorker =
  new Worker<UploadBusinessShowCaseImagesJobPayload>(
    QueueNames.UPLOAD_BUSINESS_SHOWCASE_IMAGES,
    async (job) => {
      try {
        logger.info(
          `[BUSINESS_SHOWCASE_QUEUE] Processing job ${job.id} for business ${job.data.businessId}`,
        );

        return await processUploadBusinessShowCaseImagesJob(job.data);
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

uploadBusinessShowCaseImagesWorker.on("error", (error) => {
  logger.error("[BUSINESS_SHOWCASE_QUEUE] Worker error", error);
});
