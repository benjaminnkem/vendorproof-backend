import { Router } from "express";
import { authenticate } from "../config/auth-middleware";
import * as analyticsController from "../controllers/analytics.controller";

const analyticsRouter = Router();

analyticsRouter.get(
  "/me/dashboard",
  authenticate,
  analyticsController.getDashboardAnalytics,
);
analyticsRouter.get(
  "/me/activity",
  authenticate,
  analyticsController.getActivityAnalytics,
);
analyticsRouter.get(
  "/me/profile",
  authenticate,
  analyticsController.getProfileAnalytics,
);

export default analyticsRouter;
