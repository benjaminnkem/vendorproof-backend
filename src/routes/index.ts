import { Router } from "express";
import triangleRouter from "./triangle.route";
import authRouter from "./auth.route";

import * as miscController from "../controllers/misc.controller";

const router = Router();

// misc routes
router.get("/config", miscController.getConfigs);
router.get("/health", miscController.healthCheck);

// Mount other routers
router.use("/auth", authRouter);
router.use("/triangle", triangleRouter);

export default router;
