import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";

const payRouter = Router();

// Static routes must be declared before dynamic /:token routes to avoid shadowing
payRouter.post("/webhook/squad", paymentController.squadWebhook);
payRouter.get("/verify/:squadRef", paymentController.verifyPayment);
payRouter.get("/rate/:ratingToken", paymentController.getRatingPage);
payRouter.post("/rate/:ratingToken", paymentController.submitRating);

payRouter.get("/:token", paymentController.getPaymentPage);
payRouter.post("/:token", paymentController.initiatePayment);

payRouter.get(
  "/onboarding-fee/verify/:transactionReference",
  paymentController.verifyOnboardingPayment,
);

export default payRouter;
