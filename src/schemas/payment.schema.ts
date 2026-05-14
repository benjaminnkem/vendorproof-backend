import { boolean, coerce, number, object, string, enum as enum_ } from "zod";
import { PaymentStatus } from "../generated/prisma/enums";

export const createServiceSchema = object({
  name: string().min(1, "Service name is required"),
  description: string().optional(),
  amount: number().positive("Amount must be a positive number").optional(),
  bankDetailsId: number().int().positive().optional(),
});

export type CreateServiceInput = ReturnType<typeof createServiceSchema.parse>;

export const updateServiceSchema = object({
  name: string().min(1).optional(),
  description: string().optional(),
  amount: number().positive("Amount must be a positive number").optional(),
  bankDetailsId: number().int().positive().optional(),
});

export type UpdateServiceInput = ReturnType<typeof updateServiceSchema.parse>;

export const createQuickLinkSchema = object({
  amount: number().positive("Amount must be a positive number").optional(),
  description: string().optional(),
  expiresInHours: number().int().positive().optional(),
});

export type CreateQuickLinkInput = ReturnType<
  typeof createQuickLinkSchema.parse
>;

export const initiatePaymentSchema = object({
  buyerName: string().min(1, "Buyer name is required"),
  buyerEmail: string().email("Valid email is required"),
  amount: number().positive("Amount must be a positive number").optional(),
  isServiceRendered: boolean().optional(),
});

export type InitiatePaymentInput = ReturnType<
  typeof initiatePaymentSchema.parse
>;

export const submitRatingSchema = object({
  rating: number().int().min(1).max(5),
  comment: string().optional(),
});

export type SubmitRatingInput = ReturnType<typeof submitRatingSchema.parse>;

export const getBusinessTransactionHistoryQuerySchema = object({
  page: number().int().positive().default(1),
  limit: number().int().positive().max(100).default(10),
  status: enum_([
    PaymentStatus.COMPLETED,
    PaymentStatus.PENDING,
    PaymentStatus.FAILED,
  ]).optional(),
});

export type GetBusinessTransactionHistoryQueryInput = ReturnType<
  typeof getBusinessTransactionHistoryQuerySchema.parse
>;
