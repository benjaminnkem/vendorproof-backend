import { addDays, addMinutes, isBefore } from "date-fns";
import { CustomError, HttpStatus, QueueNames } from "../@types";
import { prisma } from "../config/db";
import cloudinaryHttpService from "../infra/cloudinary/http-service";
import { enqueueKycVerificationJob } from "../queues/kyc/kyc.queue";
import { SignUpInput, VerifySignInOtpInput } from "../schemas/auth.schema";
import {
  formatPhoneNumber,
  generateOtp,
  hashPassword,
  slugify,
  toQueueFile,
} from "../utils";
import { smsQueue } from "../queues/sms/sms.queue";
import { sign } from "jsonwebtoken";

export const signUp = async (payload: SignUpInput) => {
  payload.phoneNumber = formatPhoneNumber(payload.phoneNumber);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: payload.email }, { phoneNumber: payload.phoneNumber! }],
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "Email or phone number already exists",
    );
  }

  const folder = `vendorproof/businesses/${slugify(payload.businessName)}`;

  const [businessLogoUpload, businessShowCaseImageUploads] = await Promise.all([
    payload.businessLogo
      ? cloudinaryHttpService.uploadFile({
          file: payload.businessLogo,
          folder,
          resourceType: "image",
        })
      : Promise.resolve(undefined),
    payload.businessShowCaseImages?.length
      ? Promise.all(
          payload.businessShowCaseImages.map((file) =>
            cloudinaryHttpService.uploadFile({
              file,
              folder,
              resourceType: "image",
            }),
          ),
        )
      : Promise.resolve([]),
  ]);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        phoneNumber: payload.phoneNumber,
      },
    });

    await tx.userAuth.create({
      data: {
        userId: user.id,
      },
    });

    const business = await tx.business.create({
      data: {
        ownerId: user.id,
        name: payload.businessName,
        showCaseImages: businessShowCaseImageUploads.map((item) => item.url),
        description: payload.businessDescription!,
        email: payload.businessEmail!,
        phoneNumber: payload.businessPhoneNumber!,
        alternativePhoneNumber: payload.businessAlternativePhoneNumber!,
        logo: businessLogoUpload?.url!,
        category: payload.businessCategory!,
        slug: slugify(payload.businessName),
      },
    });

    if (payload.socials?.length) {
      await tx.social.createMany({
        data: payload.socials.map((social) => ({
          businessId: business.id,
          platform: social.platform,
          url: social.url,
        })),
      });
    }

    if (payload.bankDetails) {
      await tx.bankDetails.create({
        data: {
          businessId: business.id,
          accountName: payload.bankDetails.accountName,
          accountNumber: payload.bankDetails.accountNumber,
          bankName: payload.bankDetails.bankName,
          isPrimary: true,
        },
      });
    }

    const kycSelfie = toQueueFile(payload.kycSelfie);
    const kycIdDocument = toQueueFile(payload.kycIdDocument);
    const kycBusinessCacDocument = toQueueFile(payload.kycBusinessCacDocument);

    const shouldEnqueueKyc =
      Boolean(kycSelfie) ||
      Boolean(kycIdDocument) ||
      Boolean(kycBusinessCacDocument) ||
      Boolean(payload.kycBusinessTinNumber);

    return {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      businessId: business.id,
      businessName: business.name,
      businessSlug: business.slug,
      ...(kycSelfie ? { kycSelfie } : {}),
      ...(kycIdDocument ? { kycIdDocument } : {}),
      ...(kycBusinessCacDocument ? { kycBusinessCacDocument } : {}),
      tinNumber: payload.kycBusinessTinNumber,
      shouldEnqueueKyc,
    };
  });

  if (created.shouldEnqueueKyc) {
    await enqueueKycVerificationJob({
      businessId: created.businessId,
      userId: created.userId,
      firstName: created.firstName,
      lastName: created.lastName,
      businessName: created.businessName,
      businessSlug: created.businessSlug,
      ...(created.tinNumber ? { tinNumber: created.tinNumber } : {}),
      ...(created.kycSelfie ? { kycSelfie: created.kycSelfie } : {}),
      ...(created.kycIdDocument
        ? { kycIdDocument: created.kycIdDocument }
        : {}),
      ...(created.kycBusinessCacDocument
        ? { kycBusinessCacDocument: created.kycBusinessCacDocument }
        : {}),
    });
  }

  return "OK";
};

export const signIn = async (phoneNumber: string) => {
  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

  const user = await prisma.user.findUnique({
    where: {
      phoneNumber: formattedPhoneNumber,
    },
    select: {
      id: true,
      phoneNumber: true,
    },
  });

  if (!user) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  const otp = generateOtp(6);
  const otpExpiry = addMinutes(new Date(), 15);

  await prisma.userAuth.update({
    where: { userId: user.id },
    data: {
      loginOtp: otp,
      loginOtpExpiresAt: otpExpiry,
    },
  });

  smsQueue.add(QueueNames.SEND_SMS, {
    to: [user.phoneNumber],
    message: `Your login OTP for VendorProof is ${otp}. It expires in 15 minutes.`,
  });

  return "OK";
};

export const verifySignInOtp = async (body: VerifySignInOtpInput) => {
  const formattedPhoneNumber = formatPhoneNumber(body.phoneNumber);

  const user = await prisma.userAuth.findFirst({
    where: {
      user: {
        phoneNumber: formattedPhoneNumber,
      },
    },
    select: {
      id: true,
      loginOtp: true,
      loginOtpExpiresAt: true,
    },
  });

  if (!user) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (user.loginOtp !== body.otp) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid OTP");
  }

  if (isBefore(user.loginOtpExpiresAt!, new Date())) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "OTP has expired");
  }

  const accessToken = sign(
    {
      sub: user.id,
      exp: addDays(new Date(), 7).getTime() / 1000,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "7d",
    },
  );

  await prisma.userAuth.update({
    where: { id: user.id },
    data: {
      loginOtp: null,
      loginOtpExpiresAt: null,
      lastLoginAt: new Date(),
      accessToken,
    },
  });

  return {
    accessToken,
  };
};
