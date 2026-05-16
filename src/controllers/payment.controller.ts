import { Request, Response } from "express";
import { env } from "../config/env";
import { HttpStatus } from "../@types";
import asyncHandler from "../config/async-handler";
import { AuthRequest } from "../config/auth-middleware";
import {
  createServiceSchema,
  updateServiceSchema,
  createQuickLinkSchema,
  initiatePaymentSchema,
  submitRatingSchema,
  getBusinessTransactionHistoryQuerySchema,
} from "../schemas/payment.schema";
import * as paymentService from "../services/payment.service";

// ── Vendor-facing ─────────────────────────────────────────────────────────────

export const getGenericPaymentLink = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await paymentService.getOrCreateGenericPaymentLink(
      req.businessId!,
    );
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const createService = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = createServiceSchema.parse(req.body);
    const data = await paymentService.createService(req.businessId!, payload);
    res
      .status(HttpStatus.CREATED)
      .json({ status: "success", statusCode: HttpStatus.CREATED, data });
  },
);

export const listServices = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await paymentService.listServices(req.businessId!);
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
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
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const deleteService = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    await paymentService.deleteService(req.businessId!, Number(req.params.id));
    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Service deleted",
    });
  },
);

export const createQuickLink = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const payload = createQuickLinkSchema.parse(req.body);
    const data = await paymentService.createQuickLink(req.businessId!, payload);
    res
      .status(HttpStatus.CREATED)
      .json({ status: "success", statusCode: HttpStatus.CREATED, data });
  },
);

export const listQuickLinks = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const data = await paymentService.listQuickLinks(req.businessId!);
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const deleteQuickLink = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    await paymentService.deleteQuickLink(
      req.businessId!,
      Number(req.params.id),
    );
    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      message: "Quick link deleted",
    });
  },
);

// ── Buyer-facing ─────────────────────────────────────────────────────────────

export const getPaymentPage = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await paymentService.getPaymentPage(
      req.params["token"] as string,
    );
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const initiatePayment = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = initiatePaymentSchema.parse(req.body);
    const data = await paymentService.initiatePayment(
      req.params["token"] as string,
      payload,
    );
    res
      .status(HttpStatus.CREATED)
      .json({ status: "success", statusCode: HttpStatus.CREATED, data });
  },
);

export const verifyPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await paymentService.verifyPayment(
      req.params["squadRef"] as string,
    );
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const squadWebhook = asyncHandler(
  async (req: Request, res: Response) => {
    const signature = req.headers["x-squad-encrypted-body"] as string;
    await paymentService.handleSquadWebhook((req as any).rawBody, signature);
    res.status(HttpStatus.OK).json({ status: "success" });
  },
);

export const getRatingPage = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await paymentService.getRatingPage(
      req.params["ratingToken"] as string,
    );
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const submitRating = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = submitRatingSchema.parse(req.body);
    const data = await paymentService.submitRating(
      req.params["ratingToken"] as string,
      payload,
    );
    res
      .status(HttpStatus.OK)
      .json({ status: "success", statusCode: HttpStatus.OK, data });
  },
);

export const getBusinessTransactionHistory = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const query = getBusinessTransactionHistoryQuerySchema.parse(req.query);
    const { message, data, meta } =
      await paymentService.getBusinessTransactionHistory(
        req.businessId!,
        query,
      );
    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      message,
      data,
      meta,
    });
  },
);

export const verifyOnboardingPayment = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const transactionReference = req.params["transactionReference"] as string;

    const { message, ...data } =
      await paymentService.verifyBusinessOnboardingFee(transactionReference);

    res.status(HttpStatus.OK).json({
      status: "success",
      statusCode: HttpStatus.OK,
      message,
      data,
    });
  },
);

export const redirectOnboardingPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const squadRef = req.params["squadRef"] as string;
    const scheme = env.MOBILE_DEEP_LINK_SCHEME;

    const result = await paymentService.verifyBusinessOnboardingFee(squadRef);

    if (result.status === "COMPLETED") {
      return res.redirect(`${scheme}://onboarding/verify?status=success&ref=${squadRef}`);
    }

    res.redirect(`${scheme}://onboarding/verify?status=failed&ref=${squadRef}`);
  },
);
