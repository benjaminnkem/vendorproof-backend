import { Request } from "express";
import asyncHandler from "../config/async-handler";
import { HttpStatus, CustomError } from "../@types";
import * as businessService from "../services/business.service";

export const getBusinessById = asyncHandler(async (req, res) => {
  const businessId = parseInt(req.params.businessId as string);

  if (isNaN(businessId))
    throw new CustomError(HttpStatus.BAD_REQUEST, "Invalid business ID");

  const business = await businessService.getBusinessById(businessId);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Business retrieved successfully",
    data: business,
  });
});

export const getTrustScore = asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId;
  const result = await businessService.getTrustScore(businessId);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Trust score retrieved successfully",
    data: result,
  });
});

export const getTrustScoreHistory = asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId;

  const result = await businessService.getTrustScoreHistory(businessId);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Trust score history retrieved successfully",
    data: result.history,
  });
});

export const getTrustScoreReason = asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId;
  const result = await businessService.getTrustScoreReason(businessId);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Trust score reason retrieved successfully",
    data: result,
  });
});

export const getAiProfile = asyncHandler(async (req, res) => {
  const businessId = req.user!.businessId;
  const result = await businessService.getAiProfile(businessId);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "AI profile retrieved successfully",
    data: result,
  });
});
