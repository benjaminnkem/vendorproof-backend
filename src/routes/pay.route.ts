import { Router } from "express";
import * as paymentController from "../controllers/payment.controller";

const payRouter = Router();

// /rate/:ratingToken must be declared before /:token to avoid route shadowing
payRouter.get("/rate/:ratingToken", paymentController.getRatingPage);
payRouter.post("/rate/:ratingToken", paymentController.submitRating);

payRouter.get("/:token", paymentController.getPaymentPage);
payRouter.post("/:token", paymentController.initiatePayment);

export default payRouter;
