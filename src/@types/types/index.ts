export type NodeEnv = "development" | "production" | "local";

export type UploadFileMap = Record<string, Express.Multer.File[]>;

export type KycVerificationJobPayload = {
  businessId: number;
  userId: number;
  firstName: string;
  lastName: string;
  businessName: string;
  businessSlug: string;
  tinNumber?: string;
  kycSelfie?: string;
  kycIdDocument?: string;
  kycBusinessCacDocument?: string;
};

export type KycVerificationDecision = {
  verificationType: "SELFIE" | "NIN" | "CAC" | "TIN";
  status: "APPROVED" | "REJECTED";
  score?: number;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export type QueueFilePayload = {
  bufferBase64: string;
  mimetype: string;
  originalname: string;
};

export type UploadBusinessShowCaseImagesJobPayload = {
  businessId: number;
  folder: string;
  files: QueueFilePayload[];
};
