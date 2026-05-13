import { addHours, addDays } from "date-fns";
import { CustomError, HttpStatus } from "../@types";
import { prisma } from "../config/db";
import { env } from "../config/env";
import { createAndUploadQrCode, generateToken } from "../utils";
import * as squadService from "./squad.service";
import {
  CreateServiceInput,
  UpdateServiceInput,
  CreateQuickLinkInput,
  InitiatePaymentInput,
  SubmitRatingInput,
} from "../schemas/payment.schema";
import { getBusinessExtras } from "./business.service";

const RATING_SCORE_DELTA: Record<number, number> = {
  1: -3,
  2: -1.5,
  3: 0,
  4: 1.5,
  5: 3,
};

const resolveLinkWithBaseUrl = (link: string) => {
  return `${env.FRONTEND_URL}${link}`;
};

export const getOrCreateGenericPaymentLink = async (businessId: number) => {
  let link = await prisma.paymentLink.findFirst({
    where: { businessId, type: "GENERIC" },
    select: { id: true, token: true },
  });

  if (!link) {
    const token = generateToken();
    const url = resolveLinkWithBaseUrl(`/pay/${token}`);
    const qrCode = await createAndUploadQrCode(url);

    link = await prisma.paymentLink.create({
      data: { businessId, token, type: "GENERIC" },
      select: { id: true, token: true },
    });

    await prisma.business.update({
      where: { id: businessId },
      data: { paymentLink: url, qrCodeUrl: qrCode },
    });
  }

  return {
    token: link.token,
    url: resolveLinkWithBaseUrl(`/pay/${link.token}`),
  };
};

// Payment link for Services

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
    paymentUrl: service.paymentLink
      ? resolveLinkWithBaseUrl(`/pay/${service.paymentLink.token}`)
      : null,
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
    paymentUrl: s.paymentLink
      ? resolveLinkWithBaseUrl(`/pay/${s.paymentLink.token}`)
      : null,
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
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
      ...(payload.bankDetailsId !== undefined
        ? { bankDetailsId: payload.bankDetailsId }
        : {}),
      paymentLink: {
        update: {
          ...(payload.amount !== undefined ? { amount: payload.amount } : {}),
          ...(payload.description !== undefined
            ? { description: payload.description }
            : {}),
        },
      },
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
    paymentUrl: updated.paymentLink
      ? resolveLinkWithBaseUrl(`/pay/${updated.paymentLink.token}`)
      : null,
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

// Quick onetime link

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

  return { ...link, url: resolveLinkWithBaseUrl(`/pay/${link.token}`) };
};

export const listQuickLinks = async (businessId: number) => {
  const links = await prisma.paymentLink.findMany({
    where: { businessId, type: "QUICK" },
    select: {
      id: true,
      token: true,
      amount: true,
      description: true,
      isOneTime: true,
      isUsed: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return links.map((l) => ({
    ...l,
    url: resolveLinkWithBaseUrl(`/pay/${l.token}`),
  }));
};

export const deleteQuickLink = async (businessId: number, linkId: number) => {
  const link = await prisma.paymentLink.findFirst({
    where: { id: linkId, businessId, type: "QUICK" },
  });

  if (!link) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Quick link not found");
  }

  await prisma.paymentLink.delete({ where: { id: linkId } });
};

/// Buyer facing

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
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "This payment link has already been used",
    );
  }

  if (link.expiresAt && link.expiresAt < new Date()) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "This payment link has expired",
    );
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
      socials: true,
      phoneNumber: true,
      alternativePhoneNumber: true,
      category: true,
      showCaseImages: true,
      tier: { select: { name: true } },
      owner: { select: { firstName: true, lastName: true } },
      trustScoreHistories: {
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { score: true, createdAt: true },
      },
    },
  });

  const extras = await getBusinessExtras(link.businessId);

  return {
    business: {
      ...business,
      ...extras,
    },
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
  const squadRef = generateToken();
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
      squadRef,
      status: "PENDING",
    },
    select: { id: true, amount: true, isServiceRendered: true },
  });

  // Atomically claim one-time links before hitting Squad — prevents the race
  // where two buyers simultaneously initiate payment on the same link
  if (link.isOneTime) {
    const claimed = await prisma.paymentLink.updateMany({
      where: { id: link.id, isUsed: false },
      data: { isUsed: true },
    });
    if (claimed.count === 0) {
      await prisma.payment.delete({ where: { squadRef } });
      throw new CustomError(
        HttpStatus.BAD_REQUEST,
        "This payment link has already been used",
      );
    }
  }

  let squadResult: Awaited<
    ReturnType<typeof squadService.initializeTransaction>
  >;
  try {
    squadResult = await squadService.initializeTransaction({
      email: payload.buyerEmail,
      amount,
      transactionRef: squadRef,
      customerName: payload.buyerName,
      callbackUrl: `${env.CHECKOUT_REDIRECT_URL}/payment/verify/${squadRef}`,
    });
  } catch (err) {
    // Release the claim so the link can be retried
    if (link.isOneTime) {
      await prisma.paymentLink.update({
        where: { id: link.id },
        data: { isUsed: false },
      });
    }
    await prisma.payment.delete({ where: { squadRef } });
    throw err;
  }

  return {
    paymentId: payment.id,
    amount: payment.amount,
    checkoutUrl: squadResult.checkoutUrl,
    message: "Proceed to checkout to complete your payment.",
  };
};

export const verifyPayment = async (squadRef: string) => {
  const payment = await prisma.payment.findUnique({
    where: { squadRef },
    select: {
      id: true,
      status: true,
      amount: true,
      isServiceRendered: true,
      ratingToken: true,
      buyerName: true,
      buyerEmail: true,
      squadRef: true,
      business: {
        select: {
          name: true,
          slug: true,
          logo: true,
          tier: { select: { name: true } },
          trustScore: true,
        },
      },
    },
  });

  if (!payment) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Payment not found");
  }

  if (payment.status === "COMPLETED") {
    return {
      status: "COMPLETED",
      business: payment.business,
      ratingToken: payment.isServiceRendered ? payment.ratingToken : undefined,
      amount: payment.amount,
      message: payment.isServiceRendered
        ? "Payment confirmed. You can rate this vendor now."
        : "Payment confirmed. You will receive a link to rate this vendor after the service is delivered.",
      buyerName: payment.buyerName,
      buyerEmail: payment.buyerEmail,
      transactionReference: payment.squadRef,
    };
  }

  if (payment.status === "FAILED") {
    throw new CustomError(HttpStatus.BAD_REQUEST, "Payment failed");
  }

  // Re-verify with Squad in case webhook hasn't fired yet
  const squadTx = await squadService.verifyTransaction(squadRef);

  if (squadTx.transaction_status === "success") {
    await confirmPayment(squadRef);
    return {
      status: "COMPLETED",
      business: payment.business,
      ratingToken: payment.isServiceRendered ? payment.ratingToken : undefined,
      message: payment.isServiceRendered
        ? "Payment confirmed. You can rate this vendor now."
        : "Payment confirmed. You will receive a link to rate this vendor after the service is delivered.",
      amount: payment.amount,
      buyerName: payment.buyerName,
      buyerEmail: payment.buyerEmail,
      transactionReference: payment.squadRef,
    };
  }

  return { status: payment.status, message: "Payment is still pending." };
};

const confirmPayment = async (squadRef: string) => {
  await prisma.payment.update({
    where: { squadRef },
    data: { status: "COMPLETED" },
  });
};

export const handleSquadWebhook = async (
  rawBody: string,
  signature: string,
) => {
  if (!squadService.verifyWebhookSignature(rawBody, signature)) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid webhook signature");
  }

  const event = JSON.parse(rawBody) as {
    Event: string;
    Body: { transaction_ref: string; transaction_status: string };
  };

  const { transaction_ref, transaction_status } = event.Body;

  const payment = await prisma.payment.findUnique({
    where: { squadRef: transaction_ref },
    select: {
      id: true,
      status: true,
      paymentLinkId: true,
      paymentLink: { select: { isOneTime: true } },
    },
  });

  if (!payment || payment.status !== "PENDING") return;

  if (event.Event === "charge_successful" && transaction_status === "success") {
    await confirmPayment(transaction_ref);
  } else if (transaction_status === "failed") {
    await prisma.payment.update({
      where: { squadRef: transaction_ref },
      data: { status: "FAILED" },
    });
    // Release the one-time link so it can be used again
    if (payment.paymentLink.isOneTime) {
      await prisma.paymentLink.update({
        where: { id: payment.paymentLinkId },
        data: { isUsed: false },
      });
    }
  }
};

export const getRatingPage = async (ratingToken: string) => {
  const payment = await prisma.payment.findUnique({
    where: { ratingToken },
    select: {
      id: true,
      buyerName: true,
      buyerEmail: true,
      amount: true,
      status: true,
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

  if (payment.status !== "COMPLETED") {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "Payment has not been completed",
    );
  }

  if (payment.rating) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "You have already submitted a rating",
    );
  }

  if (
    payment.ratingTokenExpiresAt &&
    payment.ratingTokenExpiresAt < new Date()
  ) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "This rating link has expired",
    );
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
      status: true,
      ratingTokenExpiresAt: true,
      rating: { select: { id: true } },
      business: { select: { trustScore: true } },
    },
  });

  if (!payment) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Rating link not found");
  }

  if (payment.status !== "COMPLETED") {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "Payment has not been completed",
    );
  }

  if (payment.rating) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "You have already submitted a rating",
    );
  }

  if (
    payment.ratingTokenExpiresAt &&
    payment.ratingTokenExpiresAt < new Date()
  ) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "This rating link has expired",
    );
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

export const getBusinessTransactionHistory = async (businessId: number) => {
  const transactions = await prisma.payment.findMany({
    where: { businessId },
    select: {
      id: true,
      amount: true,
      status: true,
      createdAt: true,
      buyerName: true,
      buyerEmail: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    message: "Transaction history retrieved successfully",
    data: transactions,
  };
};
