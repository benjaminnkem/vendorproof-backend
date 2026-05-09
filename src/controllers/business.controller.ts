import { Request } from "express";
import asyncHandler from "../config/async-handler";
import { HttpStatus, CustomError } from "../@types";
import * as businessService from "../services/business.service";
import { UpdateBusinessProfileInput, UpdateBusinessSocialsInput } from "../schemas";
import { updateBusinessProfileSchema, updateBusinessSocialsSchema } from "../schemas/business.schema";

export const getBusinessById = asyncHandler(async (req: Request<{ id: string }>, res) => {
  const id = parseInt(req.params.id);

  if (isNaN(id)) throw new CustomError(HttpStatus.BAD_REQUEST, "Invalid business ID");

  const business = await businessService.getBusinessById(id);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Business retrieved successfully",
    data: business,
  });
});

export const updateProfile = asyncHandler(
  async (req: Request<{}, {}, UpdateBusinessProfileInput>, res) => {
    const businessId = req.user!.businessId;
    const data = updateBusinessProfileSchema.parse(req.body);

    const business = await businessService.updateProfile(businessId, data);

    res.json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Business profile updated successfully",
      data: business,
    });
  },
);

export const updateSocials = asyncHandler(
  async (req: Request<{}, {}, UpdateBusinessSocialsInput>, res) => {
    const businessId = req.user!.businessId;
    const data = updateBusinessSocialsSchema.parse(req.body);

    const socials = await businessService.updateSocials(businessId, data);

    res.json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Socials updated successfully",
      data: socials,
    });
  },
);

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
  const page = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "20"))));

  const result = await businessService.getTrustScoreHistory(businessId, page, limit);

  res.json({
    status: "success",
    statusCode: HttpStatus.OK,
    message: "Trust score history retrieved successfully",
    data: result.history,
    meta: result.pagination,
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
