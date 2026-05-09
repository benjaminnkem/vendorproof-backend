import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { bufferUploader } from "../utils";

const authRouter = Router();

authRouter.post(
  "/signup",
  bufferUploader.fields([
    { name: "businessLogo", maxCount: 1 },
    { name: "businessShowCaseImages", maxCount: 10 },
    { name: "kycSelfie", maxCount: 1 },
    { name: "kycIdDocument", maxCount: 1 },
    { name: "kycBusinessCacDocument", maxCount: 1 },
    { name: "kycBusinessUtilityDocument", maxCount: 1 },
    { name: "kycBusinessTinDocument", maxCount: 1 },
  ]),
  authController.signUp,
);

export default authRouter;
