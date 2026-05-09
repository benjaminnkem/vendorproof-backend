import { Request } from "express";
import { ZodError } from "zod";
import { CustomError, HttpStatus, UploadFileMap } from "../@types";
import asyncHandler from "../config/async-handler";
import { signUpSchema, SignUpInput } from "../schemas/auth.schema";
import * as authService from "../services/auth.service";
import { parseJsonField } from "../utils";

export const signUp = asyncHandler(async (req: Request, res) => {
  let payload: SignUpInput;

  const files = (req.files ?? {}) as UploadFileMap;

  const parsedBody: SignUpInput = {
    ...req.body,
    socials: parseJsonField(req.body.socials, []),
    bankDetails: parseJsonField(req.body.bankDetails, req.body.bankDetails),
    businessLogo: files.businessLogo?.[0],
    businessShowCaseImages: files.businessShowCaseImages,
    kycSelfie: files.kycSelfie?.[0],
    kycIdDocument: files.kycIdDocument?.[0],
    kycBusinessCacDocument: files.kycBusinessCacDocument?.[0],
  };

  payload = signUpSchema.parse(parsedBody) as SignUpInput;

  await authService.signUp(payload);

  res.status(HttpStatus.CREATED).json({
    status: "success",
    statusCode: HttpStatus.CREATED,
    message: "Account created successfully",
  });
});
