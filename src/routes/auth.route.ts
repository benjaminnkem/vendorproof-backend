import { Router } from "express";
import * as authController from "../controllers/auth.controller";
import { bufferUploader } from "../utils";
import { authMiddleware } from "../middlewares/auth.middleware";

const authRouter = Router();

authRouter.post("/signup/step-1", authController.signUpStep1);

authRouter.post("/signup/step-2", authController.signUpStep2);

authRouter.post(
  "/signup/step-3",
  authMiddleware,
  bufferUploader.fields([
    { name: "kycSelfie", maxCount: 1 },
    { name: "kycIdDocument", maxCount: 1 },
  ]),
  authController.signUpStep3,
);

authRouter.post(
  "/signup/step-4",
  authMiddleware,
  bufferUploader.fields([
    { name: "businessLogo", maxCount: 1 },
    { name: "businessShowCaseImages", maxCount: 10 },
    { name: "kycBusinessCacDocument", maxCount: 1 },
  ]),
  authController.signUpStep4,
);

authRouter.post("/signin", authController.signIn);
authRouter.post("/verify-signin-otp", authController.verifySignInOtp);

authRouter.delete("/test-delete", authController.testDelete);

export default authRouter;
