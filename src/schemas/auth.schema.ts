import { any, array, boolean, email, enum as enum_, object, string } from "zod";
import { SocialPlatform } from "../generated/prisma/enums";
import { formatPhoneNumber } from "../utils";

export const signUpStep1Schema = object({
  firstName: string().min(1, "First name is required"),
  lastName: string().min(1, "Last name is required"),
  email: email("Invalid email address").optional(),
  phoneNumber: string("Phone number is required").transform((val) =>
    formatPhoneNumber(val),
  ),
});

export const signUpStep2Schema = object({
  phoneNumber: string("Phone number is required").transform((val) =>
    formatPhoneNumber(val),
  ),
  otpCode: string("OTP code is required").min(
    6,
    "OTP code must be at least 6 digits",
  ),
});

export const signUpStep3Schema = object({
  kycSelfie: any().optional(),
  kycIdDocument: any().optional(),
});

export const signUpStep4Schema = object({
  isBusinessRegistered: string()
    .optional()
    .default("false")
    .transform((val: any) => (val ? (val == "true" ? true : false) : val)),
  businessName: string().min(1, "Business name is required"),
  businessDescription: string().optional(),
  businessEmail: email("Invalid business email address").optional(),
  businessPhoneNumber: string()
    .optional()
    .transform((val) => (val ? formatPhoneNumber(val) : val)),
  businessAlternativePhoneNumber: string()
    .optional()
    .transform((val) => (val ? formatPhoneNumber(val) : val)),
  socials: array(
    object({
      platform: enum_(Object.values(SocialPlatform)),
      url: string().min(1, "Social media URL is required"),
    }),
  )
    .optional()
    .default([]),
  businessLogo: any().optional(),
  businessShowCaseImages: array(any()).optional(),
  businessCategory: string()?.optional(),
  kycBusinessCacDocument: any().optional(),
  kycBusinessTinNumber: string().optional(),

  bankDetails: object({
    accountName: string().min(1, "Account name is required"),
    accountNumber: string().min(1, "Account number is required"),
    bankName: string().min(1, "Bank name is required"),
    bankCode: string().min(1, "Bank code is required"),
  }).optional(),
});

export type SignUpStep1Input = ReturnType<typeof signUpStep1Schema.parse>;
export type SignUpStep2Input = ReturnType<typeof signUpStep2Schema.parse>;
export type SignUpStep3Input = ReturnType<typeof signUpStep3Schema.parse> & {
  kycSelfie?: Express.Multer.File;
  kycIdDocument?: Express.Multer.File;
};
export type SignUpStep4Input = ReturnType<typeof signUpStep4Schema.parse> & {
  kycBusinessCacDocument?: Express.Multer.File;
  kycBusinessTinNumber?: string;
};

export const signInSchema = object({
  phoneNumber: string("Phone number is required").transform((val) =>
    formatPhoneNumber(val),
  ),
});

export type SignInInput = ReturnType<typeof signInSchema.parse>;

export const verifySignInOtpSchema = object({
  phoneNumber: string("Phone number is required").transform((val) =>
    formatPhoneNumber(val),
  ),
  otp: string("OTP is required").min(6, "OTP must be at least 6 digits"),
});

export type VerifySignInOtpInput = ReturnType<
  typeof verifySignInOtpSchema.parse
>;
