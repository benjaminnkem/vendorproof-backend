import { Router } from "express";
import triangleRouter from "./triangle.route";

const router = Router();

router.use("/triangle", triangleRouter);

export default router;
