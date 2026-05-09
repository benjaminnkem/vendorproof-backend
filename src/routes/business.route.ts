import { Router } from "express";
import * as businessController from "../controllers/business.controller";
import { authenticate } from "../config/auth-middleware";
import { bufferUploader } from "../utils";

const businessRouter = Router();

businessRouter.get("/:slug", businessController.getPublicProfile);

businessRouter.patch(
  "/me",
  authenticate,
  bufferUploader.fields([
    { name: "businessLogo", maxCount: 1 },
    { name: "businessShowCaseImages", maxCount: 10 },
  ]),
  businessController.updateBusiness,
);

businessRouter.post("/me/socials", authenticate, businessController.addSocial);
businessRouter.delete("/me/socials/:id", authenticate, businessController.removeSocial);

businessRouter.post("/me/bank-details", authenticate, businessController.addBankDetails);
businessRouter.patch("/me/bank-details/:id", authenticate, businessController.updateBankDetails);
businessRouter.delete("/me/bank-details/:id", authenticate, businessController.removeBankDetails);

export default businessRouter;
