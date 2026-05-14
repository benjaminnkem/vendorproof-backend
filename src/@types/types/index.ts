import { TierNames } from "../../generated/prisma/enums";

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

export type DashboardAnalytics = {
  trustScore: number;
  currentTier: TierNames;
  nextTier?: TierNames;
  kycScores: {
    document?: number;
    biometric?: number;
    transactionsConsistency?: number;
    scoresToNextTier?: number;
  };

  totalEarnings: number;
  totalOrders: number;
  averageMonthlyEarnings: number;
  disputesCount: number;

  weeklyEarnings: {
    day: string;
    earnings: number;
  }[];

  scoreTrajectory: {
    month: string;
    score: number;
  }[];

  recentOrders: {
    buyerName: string;
    amount: number;
    date: string;
    status: string;
  }[];
};

export type ActivityAnalytics = {
  totalTransactions: number;
  transactions: {
    buyerName: string;
    amount: number;
    date: string;
    status: string;
  };
  dailyVolume: {
    day: string;
    volume: number;
  }[];

  totalVolume: number;

  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
};

export type ProfileAnalytics = {
  totalEarnings: number;
  totalOrders: number;
  averageMonthlyEarnings: number;
  disputesCount: number;

  kycStatus: {
    document: number;
    biometric: number;
    transactionsConsistency: number;
    scoresToNextTier: number;
  };
};
