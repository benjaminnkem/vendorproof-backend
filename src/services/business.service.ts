import { CustomError, HttpStatus } from "../@types";
import { prisma } from "../config/db";
import {
  AddBankDetailsInput,
  AddSocialInput,
  GetBusinessesQueryInput,
  UpdateBankDetailsInput,
  UpdateBusinessInput,
} from "../schemas/business.schema";
import cloudinaryHttpService from "../infra/cloudinary/http-service";
import { slugify } from "../utils";
import { BusinessWhereInput } from "../generated/prisma/models";
import { getOrCreateGenericPaymentLink } from "./payment.service";

export const getPublicProfile = async (slug: string) => {
  const getBusinessData = async () =>
    await prisma.business.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        description: true,
        logo: true,
        showCaseImages: true,
        email: true,
        phoneNumber: true,
        alternativePhoneNumber: true,
        category: true,
        slug: true,
        trustScore: true,
        kycStatus: true,
        paymentLink: true,
        qrCodeUrl: true,
        createdAt: true,
        socials: { select: { id: true, platform: true, url: true } },
        tier: { select: { name: true, description: true } },
        trustScoreHistories: {
          orderBy: { createdAt: "asc" },
          take: 10,
          select: { score: true, createdAt: true },
        },
        services: { select: { id: true, name: true, description: true } },
      },
    });
  let business = await getBusinessData();

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  if (!business.paymentLink) {
    await getOrCreateGenericPaymentLink(business.id);

    business = await getBusinessData();
  }

  const extras = await getBusinessExtras(business!.id);

  const formattedBusiness = {
    ...business,
    ...extras,
  };

  return formattedBusiness;
};

export const updateBusiness = async (
  businessId: number,
  payload: UpdateBusinessInput,
  logoFile?: Express.Multer.File,
  showcaseFiles?: Express.Multer.File[],
) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, slug: true },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const folder = `vendorproof/businesses/${business.slug}`;

  const [logoUpload, showcaseUploads] = await Promise.all([
    logoFile
      ? cloudinaryHttpService.uploadFile({
          file: logoFile,
          folder,
          resourceType: "image",
        })
      : Promise.resolve(undefined),
    showcaseFiles?.length
      ? Promise.all(
          showcaseFiles.map((f) =>
            cloudinaryHttpService.uploadFile({
              file: f,
              folder,
              resourceType: "image",
            }),
          ),
        )
      : Promise.resolve(undefined),
  ]);

  const newSlug =
    payload.name && payload.name !== business.name
      ? slugify(payload.name)
      : undefined;

  return prisma.business.update({
    where: { id: businessId },
    data: {
      ...(payload.name ? { name: payload.name } : {}),
      ...(newSlug ? { slug: newSlug } : {}),
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
      ...(payload.alternativePhoneNumber
        ? { alternativePhoneNumber: payload.alternativePhoneNumber }
        : {}),
      ...(payload.category ? { category: payload.category } : {}),
      ...(logoUpload ? { logo: logoUpload.url } : {}),
      ...(showcaseUploads
        ? { showCaseImages: showcaseUploads.map((u) => u.url) }
        : {}),
    },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      email: true,
      phoneNumber: true,
      alternativePhoneNumber: true,
      category: true,
      logo: true,
      showCaseImages: true,
      kycStatus: true,
      trustScore: true,
    },
  });
};

export const addSocial = async (
  businessId: number,
  payload: AddSocialInput,
) => {
  const existing = await prisma.social.findFirst({
    where: { businessId, platform: payload.platform as any },
  });

  if (existing) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      `A ${payload.platform} link already exists. Update or remove it first.`,
    );
  }

  return prisma.social.create({
    data: { businessId, platform: payload.platform as any, url: payload.url },
    select: { id: true, platform: true, url: true },
  });
};

export const removeSocial = async (businessId: number, socialId: number) => {
  const social = await prisma.social.findFirst({
    where: { id: socialId, businessId },
  });

  if (!social) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Social link not found");
  }

  await prisma.social.delete({ where: { id: socialId } });
};

export const addBankDetails = async (
  businessId: number,
  payload: AddBankDetailsInput,
) => {
  if (payload.isPrimary) {
    await prisma.bankDetails.updateMany({
      where: { businessId },
      data: { isPrimary: false },
    });
  }

  return prisma.bankDetails.create({
    data: {
      businessId,
      bankName: payload.bankName,
      bankCode: "",
      accountNumber: payload.accountNumber,
      accountName: payload.accountName,
      isPrimary: payload.isPrimary ?? false,
    },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountName: true,
      isPrimary: true,
    },
  });
};

export const updateBankDetails = async (
  businessId: number,
  bankId: number,
  payload: UpdateBankDetailsInput,
) => {
  const bank = await prisma.bankDetails.findFirst({
    where: { id: bankId, businessId },
  });

  if (!bank) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Bank details not found");
  }

  if (payload.isPrimary) {
    await prisma.bankDetails.updateMany({
      where: { businessId },
      data: { isPrimary: false },
    });
  }

  return prisma.bankDetails.update({
    where: { id: bankId },
    data: {
      ...(payload.bankName ? { bankName: payload.bankName } : {}),
      ...(payload.accountNumber
        ? { accountNumber: payload.accountNumber }
        : {}),
      ...(payload.accountName ? { accountName: payload.accountName } : {}),
      ...(payload.isPrimary !== undefined
        ? { isPrimary: payload.isPrimary }
        : {}),
    },
    select: {
      id: true,
      bankName: true,
      accountNumber: true,
      accountName: true,
      isPrimary: true,
    },
  });
};

export const removeBankDetails = async (businessId: number, bankId: number) => {
  const bank = await prisma.bankDetails.findFirst({
    where: { id: bankId, businessId },
  });

  if (!bank) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Bank details not found");
  }

  await prisma.bankDetails.delete({ where: { id: bankId } });
};

export const getBusinesses = async (query: GetBusinessesQueryInput) => {
  const where: BusinessWhereInput = {};

  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { description: { contains: query.search, mode: "insensitive" } },
      { category: { contains: query.search, mode: "insensitive" } },
    ];
  }

  if (query.category) {
    where.category = { equals: query.category, mode: "insensitive" };
  }

  const businesses = await prisma.business.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      logo: true,
      category: true,
      slug: true,
      trustScore: true,
      kycStatus: true,
      tier: { select: { name: true } },
      showCaseImages: true,
    },
  });

  const formatted = businesses.map((b) => ({
    ...b,
    tier: b.tier ? b.tier.name : null,
  }));

  return formatted;
};

async function calculateTrustGrowth(businessId: number) {
  const histories = await prisma.trustScoreHistory.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 2,
  });

  if (histories.length < 2) {
    return "No change in last 30 days";
  }

  const [latest, previous] = histories;
  const change = (latest?.score ?? 0) - (previous?.score ?? 0);

  if (change === 0) {
    return "No change in last 30 days";
  }

  const percentageChange = previous?.score
    ? (change / previous.score) * 100
    : 100;

  const roundedChange = Math.abs(percentageChange).toFixed(1);
  const direction = change > 0 ? "+" : "-";

  return `${direction}${roundedChange}% in last 30 days`;
}

export async function getBusinessExtras(businessId: number) {
  const ratings = await prisma.paymentRating.aggregate({
    where: { payment: { businessId: businessId } },
    _avg: { rating: true },
    _count: { rating: true },
  });

  const ratingsSummary = ratings._avg.rating
    ? parseFloat(ratings._avg.rating.toFixed(2))
    : null;

  const ratingsCount = ratings._count.rating;

  const reviews = await prisma.paymentRating.findMany({
    where: { payment: { businessId: businessId }, comment: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      rating: true,
      comment: true,
      createdAt: true,
      payment: {
        select: {
          buyerName: true,
          buyerEmail: true,
        },
      },
    },
  });

  const formattedReviews = reviews.map((r) => ({
    reviewerName: r.payment.buyerName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));

  const totalAmountTransacted = await prisma.payment
    .aggregate({
      where: { businessId: businessId, status: "COMPLETED" },
      _sum: { amount: true },
    })
    .then((result) => result._sum.amount || 0);

  const successfulTransactionsCount = await prisma.payment.count({
    where: { businessId: businessId, status: "COMPLETED" },
  });

  const totalVerifiedBuyers = await prisma.payment
    .findMany({
      where: { businessId: businessId, status: "COMPLETED" },
      select: { buyerEmail: true },
      distinct: ["buyerEmail"],
    })
    .then((buyers) => buyers.length);

  const trustGrowth = await calculateTrustGrowth(businessId);

  return {
    ratingsSummary,
    ratingsCount,
    reviews: formattedReviews,
    totalAmountTransacted,
    successfulTransactionsCount,
    totalVerifiedBuyers,
    trustGrowth,
  };
}
