import { Request } from "express";
import { ZodError } from "zod";
import { CustomError, HttpStatus, UploadFileMap } from "../@types";
import asyncHandler from "../config/async-handler";
import {
  signUpStep1Schema,
  SignUpStep1Input,
  signUpStep2Schema,
  SignUpStep2Input,
  signUpStep3Schema,
  SignUpStep3Input,
  signUpStep4Schema,
  SignUpStep4Input,
  signInSchema,
  SignInInput,
  verifySignInOtpSchema,
  VerifySignInOtpInput,
} from "../schemas/auth.schema";
import * as authService from "../services/auth.service";
import { parseJsonField } from "../utils";

export const signUpStep1 = asyncHandler(async (req: Request, res) => {
  const payload = signUpStep1Schema.parse(req.body);

  const response = await authService.signUpStep1(payload);

  res.status(response.statusCode).json(response);
});

export const signUpStep2 = asyncHandler(async (req: Request, res) => {
  const payload = signUpStep2Schema.parse(req.body);

  const response = await authService.signUpStep2(payload);

  res.status(response.statusCode).json(response);
});

export const signUpStep3 = asyncHandler(async (req: Request, res) => {
  const files = (req.files ?? {}) as UploadFileMap;

  const parsedBody = {
    ...req.body,
    kycSelfie: files.kycSelfie?.[0],
    kycIdDocument: files.kycIdDocument?.[0],
  };

  const payload = signUpStep3Schema.parse(parsedBody) as SignUpStep3Input;

  const response = await authService.signUpStep3(req.userId!, payload);

  res.status(response.statusCode).json(response);
});

export const signUpStep4 = asyncHandler(async (req: Request, res) => {
  const files = (req.files ?? {}) as UploadFileMap;

  const parsedBody = {
    ...req.body,
    businessShowCaseImages: files.businessShowCaseImages,
    businessLogo: files.businessLogo?.[0],
    kycBusinessCacDocument: files.kycBusinessCacDocument?.[0],
    bankDetails: parseJsonField(req.body.bankDetails, req.body.bankDetails),
    socials: parseJsonField(req.body.socials, []),
  };

  const payload = signUpStep4Schema.parse(parsedBody) as SignUpStep4Input;

  const response = await authService.signUpStep4(req.userId!, payload);

  res.status(response.statusCode).json(response);
});

export const signIn = asyncHandler(
  async (req: Request<{}, {}, SignInInput>, res) => {
    const parsed = signInSchema.parse(req.body);

    const response = await authService.signIn(parsed?.phoneNumber);

    res.status(response.statusCode).json(response);
  },
);

export const verifySignInOtp = asyncHandler(
  async (req: Request<{}, {}, VerifySignInOtpInput>, res) => {
    const parsed = verifySignInOtpSchema.parse(req.body);

    const response = await authService.verifySignInOtp(parsed);

    res.status(response.statusCode).json(response);
  },
);

export const testDelete = asyncHandler(async (req: Request, res) => {
  const response = await authService.testDelete(req.body.phoneNumber);

  res.status(response.statusCode).json(response);
});
