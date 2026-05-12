import { Router } from "express";
import * as businessController from "../controllers/business.controller";
import * as paymentController from "../controllers/payment.controller";
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

businessRouter.get("/me/payment-link", authenticate, paymentController.getGenericPaymentLink);
businessRouter.get("/me/payment-links/quick", authenticate, paymentController.listQuickLinks);
businessRouter.post("/me/payment-links/quick", authenticate, paymentController.createQuickLink);
businessRouter.delete("/me/payment-links/quick/:id", authenticate, paymentController.deleteQuickLink);

businessRouter.get("/me/services", authenticate, paymentController.listServices);
businessRouter.post("/me/services", authenticate, paymentController.createService);
businessRouter.patch("/me/services/:id", authenticate, paymentController.updateService);
businessRouter.delete("/me/services/:id", authenticate, paymentController.deleteService);

export default businessRouter;
