import { Response } from "express";
import { HttpStatus } from "../@types";
import asyncHandler from "../config/async-handler";
import { AuthRequest } from "../config/auth-middleware";
import * as analyticsService from "../services/analytics.service";

export const getDashboardAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await analyticsService.getDashboardAnalytics(req.businessId!);

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);

export const getActivityAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await analyticsService.getActivityAnalytics(req.businessId!);

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);

export const getProfileAnalytics = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await analyticsService.getProfileAnalytics(req.businessId!);

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);
