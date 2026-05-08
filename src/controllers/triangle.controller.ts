import { Request } from "express";
import asyncHandler from "../config/async-handler";
import * as triangleService from "../services/triangle.service";
import { CalculateTriangleAreaInput } from "../schemas";
import { HttpStatus } from "../@types";

export const calculateTriangleArea = asyncHandler(
  async (req: Request<{}, {}, CalculateTriangleAreaInput>, res) => {
    const area = triangleService.calculateTriangleArea(
      req.body.base,
      req.body.height,
    );

    res.json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Triangle area calculated successfully",
      data: { area },
      meta: null,
    });
  },
);
