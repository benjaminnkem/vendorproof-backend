import { Router } from "express";
import * as triangleController from "../controllers/triangle.controller";

const triangleRouter = Router();

triangleRouter.post("/area", triangleController.calculateTriangleArea);

export default triangleRouter;
