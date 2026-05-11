import { Router } from "express";
import triangleRouter from "./triangle.route";
import authRouter from "./auth.route";
import businessRouter from "./business.route";
import payRouter from "./pay.route";

import * as miscController from "../controllers/misc.controller";

const router = Router();

// misc routes
router.get("/config", miscController.getConfigs);
router.get("/health", miscController.healthCheck);

// Mount other routers
router.use("/auth", authRouter);
router.use("/business", businessRouter);
router.use("/pay", payRouter);
router.use("/triangle", triangleRouter);

export default router;
