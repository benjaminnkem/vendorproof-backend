import { Request, Response } from "express";
import { HttpStatus } from "../@types";
import asyncHandler from "../config/async-handler";
import { AuthRequest } from "../config/auth-middleware";
import {
  createServiceSchema,
  updateServiceSchema,
  createQuickLinkSchema,
  initiatePaymentSchema,
  submitRatingSchema,
} from "../schemas/payment.schema";
import * as paymentService from "../services/payment.service";

// ── Vendor-facing ─────────────────────────────────────────────────────────────

export const getGenericPaymentLink = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await paymentService.getOrCreateGenericPaymentLink(req.businessId!);
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const createService = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = createServiceSchema.parse(req.body);
    const data = await paymentService.createService(req.businessId!, payload);
    res.status(HttpStatus.CREATED).json({ status: "success", statusCode: HttpStatus.CREATED, data });
  },
);

export const listServices = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await paymentService.listServices(req.businessId!);
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const updateService = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = updateServiceSchema.parse(req.body);
    const data = await paymentService.updateService(
      req.businessId!,
      Number(req.params.id),
      payload,
    );
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const deleteService = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    await paymentService.deleteService(req.businessId!, Number(req.params.id));
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, message: "Service deleted" });
  },
);

export const createQuickLink = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = createQuickLinkSchema.parse(req.body);
    const data = await paymentService.createQuickLink(req.businessId!, payload);
    res.status(HttpStatus.CREATED).json({ status: "success", statusCode: HttpStatus.CREATED, data });
  },
);

// ── Buyer-facing ─────────────────────────────────────────────────────────────

export const getPaymentPage = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await paymentService.getPaymentPage(req.params["token"] as string);
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const initiatePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = initiatePaymentSchema.parse(req.body);
    const data = await paymentService.initiatePayment(req.params["token"] as string, payload);
    res.status(HttpStatus.CREATED).json({ status: "success", statusCode: HttpStatus.CREATED, data });
  },
);

export const getRatingPage = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await paymentService.getRatingPage(req.params["ratingToken"] as string);
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const submitRating = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = submitRatingSchema.parse(req.body);
    const data = await paymentService.submitRating(req.params["ratingToken"] as string, payload);
    res.status(HttpStatus.OK).json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);
