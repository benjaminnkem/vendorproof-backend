import { Router } from "express";
import triangleRouter from "./triangle.route";

import * as miscController from "../controllers/misc.controller";

const router = Router();

// misc routes
router.get("/config", miscController.getConfigs);
router.get("/health", miscController.healthCheck);

// Mount other routers
router.use("/triangle", triangleRouter);

export default router;
