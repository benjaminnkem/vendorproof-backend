import { addHours, addDays } from "date-fns";
import { CustomError, HttpStatus } from "../@types";
import { prisma } from "../config/db";
import { generateToken } from "../utils";
import {
  CreateServiceInput,
  UpdateServiceInput,
  CreateQuickLinkInput,
  InitiatePaymentInput,
  SubmitRatingInput,
} from "../schemas/payment.schema";

const RATING_SCORE_DELTA: Record<number, number> = {
  1: -3,
  2: -1.5,
  3: 0,
  4: 1.5,
  5: 3,
};

// ── Generic payment link ────────────────────────────────────────────────────

export const getOrCreateGenericPaymentLink = async (businessId: number) => {
  let link = await prisma.paymentLink.findFirst({
    where: { businessId, type: "GENERIC" },
    select: { id: true, token: true },
  });

  if (!link) {
    const token = generateToken();
    link = await prisma.paymentLink.create({
      data: { businessId, token, type: "GENERIC" },
      select: { id: true, token: true },
    });

    await prisma.business.update({
      where: { id: businessId },
      data: { paymentLink: `/pay/${token}` },
    });
  }

  return { token: link.token, url: `/pay/${link.token}` };
};

// ── Services ────────────────────────────────────────────────────────────────

export const createService = async (
  businessId: number,
  payload: CreateServiceInput,
) => {
  if (payload.bankDetailsId) {
    const bank = await prisma.bankDetails.findFirst({
      where: { id: payload.bankDetailsId, businessId },
    });
    if (!bank) {
      throw new CustomError(HttpStatus.NOT_FOUND, "Bank account not found");
    }
  }

  const token = generateToken();

  const service = await prisma.service.create({
    data: {
      businessId,
      name: payload.name,
      description: payload.description ?? null,
      amount: payload.amount ?? null,
      bankDetailsId: payload.bankDetailsId ?? null,
      paymentLink: {
        create: {
          businessId,
          token,
          type: "SERVICE",
          amount: payload.amount ?? null,
          description: payload.description ?? null,
        },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
      amount: true,
      bankDetailsId: true,
      createdAt: true,
      paymentLink: { select: { token: true } },
    },
  });

  return {
    ...service,
    paymentUrl: `/pay/${service.paymentLink?.token}`,
    paymentLink: undefined,
  };
};

export const listServices = async (businessId: number) => {
  const services = await prisma.service.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      description: true,
      amount: true,
      bankDetailsId: true,
      createdAt: true,
      paymentLink: { select: { token: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return services.map((s) => ({
    ...s,
    paymentUrl: s.paymentLink ? `/pay/${s.paymentLink.token}` : null,
    paymentLink: undefined,
  }));
};

export const updateService = async (
  businessId: number,
  serviceId: number,
  payload: UpdateServiceInput,
) => {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId },
  });

  if (!service) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Service not found");
  }

  if (payload.bankDetailsId) {
    const bank = await prisma.bankDetails.findFirst({
      where: { id: payload.bankDetailsId, businessId },
    });
    if (!bank) {
      throw new CustomError(HttpStatus.NOT_FOUND, "Bank account not found");
    }
  }

  const updated = await prisma.service.update({
    where: { id: serviceId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      ...(payload.bankDetailsId !== undefined ? { bankDetailsId: payload.bankDetailsId } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
      amount: true,
      bankDetailsId: true,
      paymentLink: { select: { token: true } },
    },
  });

  return {
    ...updated,
    paymentUrl: updated.paymentLink ? `/pay/${updated.paymentLink.token}` : null,
    paymentLink: undefined,
  };
};

export const deleteService = async (businessId: number, serviceId: number) => {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId },
  });

  if (!service) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Service not found");
  }

  await prisma.service.delete({ where: { id: serviceId } });
};

// ── Quick one-time links ─────────────────────────────────────────────────────

export const createQuickLink = async (
  businessId: number,
  payload: CreateQuickLinkInput,
) => {
  const token = generateToken();
  const expiresAt = payload.expiresInHours
    ? addHours(new Date(), payload.expiresInHours)
    : undefined;

  const link = await prisma.paymentLink.create({
    data: {
      businessId,
      token,
      type: "QUICK",
      amount: payload.amount ?? null,
      description: payload.description ?? null,
      isOneTime: true,
      expiresAt: expiresAt ?? null,
    },
    select: {
      id: true,
      token: true,
      amount: true,
      description: true,
      expiresAt: true,
    },
  });

  return { ...link, url: `/pay/${link.token}` };
};

// ── Buyer-facing ─────────────────────────────────────────────────────────────

const resolvePaymentLink = async (token: string) => {
  const link = await prisma.paymentLink.findUnique({
    where: { token },
    select: {
      id: true,
      type: true,
      amount: true,
      description: true,
      isOneTime: true,
      isUsed: true,
      expiresAt: true,
      businessId: true,
      service: { select: { id: true, name: true } },
    },
  });

  if (!link) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Payment link not found");
  }

  if (link.isOneTime && link.isUsed) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "This payment link has already been used");
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "This payment link has expired");
  }

  return link;
};

export const getPaymentPage = async (token: string) => {
  const link = await resolvePaymentLink(token);

  const business = await prisma.business.findUnique({
    where: { id: link.businessId },
    select: {
      name: true,
      description: true,
      logo: true,
      slug: true,
      trustScore: true,
      kycStatus: true,
      tier: { select: { name: true } },
      trustScoreHistories: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { score: true, createdAt: true },
      },
    },
  });

  return {
    business,
    paymentLink: {
      type: link.type,
      amount: link.amount,
      description: link.description ?? link.service?.name,
      isOneTime: link.isOneTime,
    },
  };
};

export const initiatePayment = async (
  token: string,
  payload: InitiatePaymentInput,
) => {
  const link = await resolvePaymentLink(token);

  const amount = link.amount ?? payload.amount;
  if (!amount) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "Amount is required for this payment link",
    );
  }

  const ratingToken = generateToken();
  const ratingTokenExpiresAt = payload.isServiceRendered
    ? addDays(new Date(), 7)
    : addDays(new Date(), 30);

  const payment = await prisma.payment.create({
    data: {
      paymentLinkId: link.id,
      businessId: link.businessId,
      buyerName: payload.buyerName,
      buyerEmail: payload.buyerEmail,
      amount,
      isServiceRendered: payload.isServiceRendered ?? false,
      ratingToken,
      ratingTokenExpiresAt,
      status: "PENDING",
    },
    select: {
      id: true,
      buyerName: true,
      buyerEmail: true,
      amount: true,
      isServiceRendered: true,
      ratingToken: true,
      status: true,
    },
  });

  if (link.isOneTime) {
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { isUsed: true },
    });
  }

  return {
    paymentId: payment.id,
    amount: payment.amount,
    isServiceRendered: payment.isServiceRendered,
    ratingToken: payment.isServiceRendered ? payment.ratingToken : undefined,
    message: payment.isServiceRendered
      ? "Payment recorded. You can rate this vendor now."
      : "Payment recorded. You will receive an email to rate this vendor after the service is delivered.",
  };
};

export const getRatingPage = async (ratingToken: string) => {
  const payment = await prisma.payment.findUnique({
    where: { ratingToken },
    select: {
      id: true,
      buyerName: true,
      buyerEmail: true,
      amount: true,
      isServiceRendered: true,
      ratingTokenExpiresAt: true,
      rating: { select: { rating: true } },
      business: {
        select: { name: true, logo: true, slug: true, trustScore: true },
      },
    },
  });

  if (!payment) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Rating link not found");
  }

  if (payment.rating) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "You have already submitted a rating");
  }

  if (payment.ratingTokenExpiresAt && payment.ratingTokenExpiresAt < new Date()) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "This rating link has expired");
  }

  return {
    paymentId: payment.id,
    buyerName: payment.buyerName,
    amount: payment.amount,
    business: payment.business,
  };
};

export const submitRating = async (
  ratingToken: string,
  payload: SubmitRatingInput,
) => {
  const payment = await prisma.payment.findUnique({
    where: { ratingToken },
    select: {
      id: true,
      businessId: true,
      ratingTokenExpiresAt: true,
      rating: { select: { id: true } },
      business: { select: { trustScore: true } },
    },
  });

  if (!payment) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Rating link not found");
  }

  if (payment.rating) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "You have already submitted a rating");
  }

  if (payment.ratingTokenExpiresAt && payment.ratingTokenExpiresAt < new Date()) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "This rating link has expired");
  }

  const delta = RATING_SCORE_DELTA[payload.rating] ?? 0;
  const scoreBefore = payment.business.trustScore;
  const scoreAfter = Math.max(0, Math.min(100, scoreBefore + delta));

  await prisma.$transaction([
    prisma.paymentRating.create({
      data: {
        paymentId: payment.id,
        rating: payload.rating,
        comment: payload.comment ?? null,
      },
    }),
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "COMPLETED" },
    }),
    prisma.trustEntry.create({
      data: {
        businessId: payment.businessId,
        rating: payload.rating,
        ...(payload.comment !== undefined ? { comment: payload.comment } : {}),
        scoreIncrement: delta,
        scoreBefore,
        scoreAfter,
      },
    }),
    prisma.business.update({
      where: { id: payment.businessId },
      data: { trustScore: scoreAfter },
    }),
    prisma.trustScoreHistory.create({
      data: { businessId: payment.businessId, score: scoreAfter },
    }),
  ]);

  return { message: "Thank you for your feedback!", newTrustScore: scoreAfter };
};
