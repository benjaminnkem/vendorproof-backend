import { number, object, string } from "zod";

export const createServiceSchema = object({
  name: string().min(1, "Service name is required"),
  description: string().optional(),
  amount: string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val > 0), {
      message: "Amount must be a positive number",
    }),
  bankDetailsId: string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined)),
});

export type CreateServiceInput = ReturnType<typeof createServiceSchema.parse>;

export const updateServiceSchema = object({
  name: string().min(1).optional(),
  description: string().optional(),
  amount: string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val > 0), {
      message: "Amount must be a positive number",
    }),
  bankDetailsId: string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined)),
});

export type UpdateServiceInput = ReturnType<typeof updateServiceSchema.parse>;

export const createQuickLinkSchema = object({
  amount: string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val > 0), {
      message: "Amount must be a positive number",
    }),
  description: string().optional(),
  expiresInHours: string()
    .optional()
    .transform((val) => (val !== undefined ? parseInt(val, 10) : undefined)),
});

export type CreateQuickLinkInput = ReturnType<typeof createQuickLinkSchema.parse>;

export const initiatePaymentSchema = object({
  buyerName: string().min(1, "Buyer name is required"),
  buyerEmail: string().email("Valid email is required"),
  amount: string()
    .optional()
    .transform((val) => (val !== undefined ? parseFloat(val) : undefined))
    .refine((val) => val === undefined || (!isNaN(val) && val > 0), {
      message: "Amount must be a positive number",
    }),
  isServiceRendered: string()
    .optional()
    .transform((val) => val === "true"),
});

export type InitiatePaymentInput = ReturnType<typeof initiatePaymentSchema.parse>;

export const submitRatingSchema = object({
  rating: number().int().min(1).max(5),
  comment: string().optional(),
});

export type SubmitRatingInput = ReturnType<typeof submitRatingSchema.parse>;
