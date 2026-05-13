import { any, array, email, enum as enum_, object, string } from "zod";
import { SocialPlatform } from "../generated/prisma/enums";
import { formatPhoneNumber } from "../utils";

export const updateBusinessSchema = object({
  name: string().min(1).optional(),
  description: string().optional(),
  email: email().optional(),
  phoneNumber: string()
    .optional()
    .transform((val) => (val ? formatPhoneNumber(val) : val)),
  alternativePhoneNumber: string()
    .optional()
    .transform((val) => (val ? formatPhoneNumber(val) : val)),
  category: string().optional(),
  businessLogo: any().optional(),
  businessShowCaseImages: array(any()).optional(),
});

export type UpdateBusinessInput = ReturnType<typeof updateBusinessSchema.parse>;

export const addSocialSchema = object({
  platform: enum_(Object.values(SocialPlatform) as [string, ...string[]]),
  url: string().url("Must be a valid URL"),
});

export type AddSocialInput = ReturnType<typeof addSocialSchema.parse>;

export const addBankDetailsSchema = object({
  bankName: string().min(1, "Bank name is required"),
  accountNumber: string().min(10, "Account number must be at least 10 digits"),
  accountName: string().min(1, "Account name is required"),
  isPrimary: string()
    .optional()
    .transform((val) => val === "true"),
});

export type AddBankDetailsInput = ReturnType<typeof addBankDetailsSchema.parse>;

export const updateBankDetailsSchema = object({
  bankName: string().min(1).optional(),
  accountNumber: string().min(10).optional(),
  accountName: string().min(1).optional(),
  isPrimary: string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
});

export type UpdateBankDetailsInput = ReturnType<
  typeof updateBankDetailsSchema.parse
>;

export const getBusienssesQuerySchema = object({
  search: string().optional(),
  category: string().optional(),
});

export type GetBusinessesQueryInput = ReturnType<
  typeof getBusienssesQuerySchema.parse
>;
