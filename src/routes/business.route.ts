import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as businessController from "../controllers/business.controller";

const businessRouter = Router();

// trust-score sub-routes must come before /:id to avoid param conflicts
businessRouter.get(
  "/trust-score/history",
  authenticate,
  businessController.getTrustScoreHistory,
);
businessRouter.get(
  "/trust-score/reason",
  authenticate,
  businessController.getTrustScoreReason,
);
businessRouter.get(
  "/trust-score",
  authenticate,
  businessController.getTrustScore,
);
businessRouter.get(
  "/ai-profile",
  authenticate,
  businessController.getAiProfile,
);

// public
businessRouter.get("/:businessId", businessController.getBusinessById);

export default businessRouter;
