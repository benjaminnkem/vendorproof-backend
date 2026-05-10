import { CustomError, HttpStatus } from "../@types";
import { prisma } from "../config/db";
import {
  AddBankDetailsInput,
  AddSocialInput,
  UpdateBankDetailsInput,
  UpdateBusinessInput,
} from "../schemas/business.schema";
import cloudinaryHttpService from "../infra/cloudinary/http-service";
import { slugify } from "../utils";

export const getPublicProfile = async (slug: string) => {
  const business = await prisma.business.findUnique({
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
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { score: true, createdAt: true },
      },
    },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  return business;
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
      ? cloudinaryHttpService.uploadFile({ file: logoFile, folder, resourceType: "image" })
      : Promise.resolve(undefined),
    showcaseFiles?.length
      ? Promise.all(
          showcaseFiles.map((f) =>
            cloudinaryHttpService.uploadFile({ file: f, folder, resourceType: "image" }),
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
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.email ? { email: payload.email } : {}),
      ...(payload.phoneNumber ? { phoneNumber: payload.phoneNumber } : {}),
      ...(payload.alternativePhoneNumber
        ? { alternativePhoneNumber: payload.alternativePhoneNumber }
        : {}),
      ...(payload.category ? { category: payload.category } : {}),
      ...(logoUpload ? { logo: logoUpload.url } : {}),
      ...(showcaseUploads ? { showCaseImages: showcaseUploads.map((u) => u.url) } : {}),
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

export const addSocial = async (businessId: number, payload: AddSocialInput) => {
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
      ...(payload.accountNumber ? { accountNumber: payload.accountNumber } : {}),
      ...(payload.accountName ? { accountName: payload.accountName } : {}),
      ...(payload.isPrimary !== undefined ? { isPrimary: payload.isPrimary } : {}),
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

export const removeBankDetails = async (
  businessId: number,
  bankId: number,
) => {
  const bank = await prisma.bankDetails.findFirst({
    where: { id: bankId, businessId },
  });

  if (!bank) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Bank details not found");
  }

  await prisma.bankDetails.delete({ where: { id: bankId } });
};
