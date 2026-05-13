import { Response } from "express";
import { HttpStatus, UploadFileMap } from "../@types";
import asyncHandler from "../config/async-handler";
import { AuthRequest } from "../config/auth-middleware";
import {
  addBankDetailsSchema,
  addSocialSchema,
  updateBankDetailsSchema,
  updateBusinessSchema,
} from "../schemas/business.schema";
import * as businessService from "../services/business.service";

export const getPublicProfile = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const slug = req.params.slug as string;
    const data = await businessService.getPublicProfile(slug);

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);

export const updateBusiness = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const files = (req.files ?? {}) as UploadFileMap;
    const payload = updateBusinessSchema.parse(req.body);

    const data = await businessService.updateBusiness(
      req.businessId!,
      payload,
      files.businessLogo?.[0],
      files.businessShowCaseImages,
    );

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);

export const addSocial = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = addSocialSchema.parse(req.body);
    const data = await businessService.addSocial(req.businessId!, payload);

    res.status(HttpStatus.CREATED).json({
      status: "success",
      statusCode: HttpStatus.CREATED,
      data,
    });
  },
);

export const removeSocial = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    await businessService.removeSocial(req.businessId!, Number(req.params.id));

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Social link removed",
    });
  },
);

export const addBankDetails = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = addBankDetailsSchema.parse(req.body);
    const data = await businessService.addBankDetails(req.businessId!, payload);

    res.status(HttpStatus.CREATED).json({
      status: "success",
      statusCode: HttpStatus.CREATED,
      data,
    });
  },
);

export const updateBankDetails = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = updateBankDetailsSchema.parse(req.body);
    const data = await businessService.updateBankDetails(
      req.businessId!,
      Number(req.params.id),
      payload,
    );

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);

export const removeBankDetails = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    await businessService.removeBankDetails(
      req.businessId!,
      Number(req.params.id),
    );

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Bank details removed",
    });
  },
);

export const getBusinesses = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const query = req.query;
    const data = await businessService.getBusinesses(query);

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      data,
    });
  },
);
