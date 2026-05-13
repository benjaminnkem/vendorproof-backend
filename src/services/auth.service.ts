import { addDays, addMinutes, isBefore } from "date-fns";
import {
  CustomError,
  HttpStatus,
  QueueFilePayload,
  QueueNames,
} from "../@types";
import { prisma } from "../config/db";
import cloudinaryHttpService from "../infra/cloudinary/http-service";
import { enqueueKycVerificationJob } from "../queues/kyc/kyc.queue";
import { enqueueUploadBusinessShowCaseImagesJob } from "../queues/upload-business-showcase-images/upload-business-showcase-images.queue";
import {
  SignUpStep1Input,
  SignUpStep2Input,
  SignUpStep3Input,
  SignUpStep4Input,
  VerifySignInOtpInput,
} from "../schemas/auth.schema";
import {
  formatPhoneNumber,
  generateOtp,
  hashPassword,
  slugify,
  toQueueFile,
} from "../utils";
import { smsQueue } from "../queues/sms/sms.queue";
import { sign } from "jsonwebtoken";
import { env } from "../config/env";
import { getOrCreateGenericPaymentLink } from "./payment.service";

const step1Action = async (phoneNumber: string) => {
  const userAuth = await prisma.userAuth.findFirst({
    where: {
      user: {
        phoneNumber,
      },
    },
    select: {
      id: true,
      loginOtp: true,
      loginOtpExpiresAt: true,
      userId: true,
    },
  });

  if (!userAuth) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  const otp = generateOtp(6);
  const otpExpiry = addMinutes(new Date(), 15);

  await prisma.userAuth.update({
    where: { id: userAuth.id },
    data: {
      loginOtp: otp,
      loginOtpExpiresAt: otpExpiry,
      authStep: 2,
    },
  });

  await smsQueue.add(QueueNames.SEND_SMS, {
    to: [phoneNumber],
    message: `Your OTP for VendorProof is ${otp}. It expires in 15 minutes.`,
  });

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "OTP sent to registered phone number",
    data: {
      nextStep: 2,
    },
    meta: {
      otp,
    },
  };
};

export const signUpStep1 = async (payload: SignUpStep1Input) => {
  payload.phoneNumber = formatPhoneNumber(payload.phoneNumber);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        ...(payload.email ? [{ email: payload.email }] : []),
        { phoneNumber: payload.phoneNumber! },
      ],
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "Email or phone number already exists, login instead.",
    );
  }

  const user = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email!,
      phoneNumber: payload.phoneNumber,
    },
  });

  const otp = generateOtp(6);
  const otpExpiry = addMinutes(new Date(), 15);

  await prisma.userAuth.create({
    data: {
      userId: user.id,
      authStep: 2,
      loginOtp: otp,
      loginOtpExpiresAt: otpExpiry,
    },
  });

  return await step1Action(payload.phoneNumber);
};

export const signUpStep2 = async (payload: SignUpStep2Input) => {
  payload.phoneNumber = formatPhoneNumber(payload.phoneNumber);

  const userAuth = await prisma.userAuth.findFirst({
    where: {
      user: {
        phoneNumber: payload.phoneNumber,
      },
    },
    select: {
      id: true,
      loginOtp: true,
      loginOtpExpiresAt: true,
      userId: true,
    },
  });

  if (!userAuth) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  if (userAuth.loginOtp !== payload.otpCode) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "Invalid OTP");
  }

  if (isBefore(userAuth.loginOtpExpiresAt!, new Date())) {
    throw new CustomError(HttpStatus.UNAUTHORIZED, "OTP has expired");
  }

  const accessToken = sign(
    {
      sub: userAuth.userId?.toString(),
      exp: addDays(new Date(), 7).getTime(),
    },
    env.JWT_SECRET!,
  );

  await prisma.userAuth.update({
    where: { id: userAuth.id },
    data: {
      authStep: 3,
      loginOtp: null,
      loginOtpExpiresAt: null,
      accessToken,
    },
  });

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "OTP verified successfully",
    data: {
      accessToken,
      nextStep: 3,
    },
  };
};

export const signUpStep3 = async (
  userId: number,
  payload: SignUpStep3Input,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  const [kycSelfieUrl, kycIdDocumentUrl] = await Promise.all([
    payload.kycSelfie
      ? cloudinaryHttpService.uploadFile({
          file: payload.kycSelfie,
          folder: `vendorproof/kyc/${userId}`,
          resourceType: "image",
        })
      : Promise.resolve(undefined),
    payload.kycIdDocument
      ? cloudinaryHttpService.uploadFile({
          file: payload.kycIdDocument,
          folder: `vendorproof/kyc/${userId}`,
          resourceType: "image",
        })
      : Promise.resolve(undefined),
  ]);

  await prisma.userAuth.update({
    where: { userId },
    data: {
      authStep: 4,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      kycSelfieUrl: kycSelfieUrl?.url ?? null,
      kycIdDocumentUrl: kycIdDocumentUrl?.url ?? null,
    },
  });

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "KYC documents uploaded successfully",
    data: {
      nextStep: 4,
    },
  };
};

export const signUpStep4 = async (
  userId: number,
  payload: SignUpStep4Input,
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  const slug = slugify(payload.businessName);

  const existingBusinessWithSlug = await prisma.business.findUnique({
    where: { slug },
  });

  if (existingBusinessWithSlug) {
    throw new CustomError(
      HttpStatus.BAD_REQUEST,
      "Another business with the same name already exists, please choose a different name.",
    );
  }

  const folder = `vendorproof/businesses/${slugify(payload.businessName)}`;

  const [businessLogoUrl, kycBusinessCacDocumentUrl] = await Promise.all([
    payload.businessLogo
      ? cloudinaryHttpService.uploadFile({
          file: payload.businessLogo,
          folder,
          resourceType: "image",
        })
      : Promise.resolve(undefined),

    payload.kycBusinessCacDocument
      ? cloudinaryHttpService.uploadFile({
          file: payload.kycBusinessCacDocument,
          folder: `vendorproof/kyc/${userId}`,
          resourceType: "image",
        })
      : Promise.resolve(undefined),
  ]);

  const createdBusiness = await prisma.business.create({
    data: {
      isRegistered: payload.isBusinessRegistered,
      ownerId: userId,
      name: payload.businessName,
      description: payload.businessDescription!,
      email: payload.businessEmail!,
      phoneNumber: payload.businessPhoneNumber!,
      alternativePhoneNumber: payload.businessAlternativePhoneNumber!,
      logo: businessLogoUrl?.url!,
      showCaseImages: [],
      category: payload.businessCategory!,
      slug,
      kycBusinessCacDocumentUrl: kycBusinessCacDocumentUrl?.url!,
      kycBusinessTinNumber: payload.kycBusinessTinNumber!,
    },
  });

  const showCaseQueueFiles: QueueFilePayload[] = (
    payload.businessShowCaseImages ?? []
  )
    .map((file) => toQueueFile(file as Express.Multer.File))
    .filter((file): file is QueueFilePayload => Boolean(file));

  if (showCaseQueueFiles.length) {
    await enqueueUploadBusinessShowCaseImagesJob({
      businessId: createdBusiness.id,
      folder,
      files: showCaseQueueFiles,
    });
  }

  if (payload.socials?.length) {
    await prisma.social.createMany({
      data: payload.socials.map((social) => ({
        businessId: createdBusiness.id,
        platform: social.platform,
        url: social.url,
      })),
    });
  }

  if (payload.bankDetails) {
    await prisma.bankDetails.create({
      data: {
        businessId: createdBusiness.id,
        accountName: payload.bankDetails.accountName,
        accountNumber: payload.bankDetails.accountNumber,
        bankName: payload.bankDetails.bankName,
        bankCode: payload.bankDetails.bankCode,
        isPrimary: true,
      },
    });
  }

  await getOrCreateGenericPaymentLink(createdBusiness.id);

  const accessToken = sign(
    {
      sub: userId?.toString(),
      exp: addDays(new Date(), 7).getTime(),
    },
    env.JWT_SECRET!,
  );

  await prisma.userAuth.update({
    where: { userId },
    data: {
      accessToken,
      authStep: null,
    },
  });

  const shouldEnqueueKyc =
    Boolean(kycBusinessCacDocumentUrl) ||
    Boolean(payload.kycBusinessTinNumber) ||
    Boolean(user.kycSelfieUrl) ||
    Boolean(user.kycIdDocumentUrl);

  if (shouldEnqueueKyc) {
    await enqueueKycVerificationJob({
      businessId: createdBusiness.id,
      userId,
      firstName: user.firstName,
      lastName: user.lastName,
      businessName: createdBusiness.name,
      businessSlug: createdBusiness.slug,
      ...(payload.kycBusinessTinNumber
        ? { tinNumber: payload.kycBusinessTinNumber }
        : {}),
      ...(user.kycSelfieUrl ? { kycSelfie: user.kycSelfieUrl } : {}),
      ...(user.kycIdDocumentUrl
        ? { kycIdDocument: user.kycIdDocumentUrl }
        : {}),
      ...(payload.kycBusinessCacDocument
        ? {
            kycBusinessCacDocument: kycBusinessCacDocumentUrl?.url!,
          }
        : {}),
    });
  }

  return {
    status: "success",
    statusCode: HttpStatus.CREATED,
    message: "Business created successfully",
    data: {
      accessToken,
    },
  };
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

  const userAuth = await prisma.userAuth.findUnique({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      authStep: true,
    },
  });

  switch (userAuth?.authStep) {
    case 1:
    case 2:
      return await step1Action(formattedPhoneNumber);
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

  await smsQueue.add(QueueNames.SEND_SMS, {
    to: [user.phoneNumber],
    message: `Your login OTP for VendorProof is ${otp}. It expires in 15 minutes.`,
  });

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "OTP sent to your phone number",
    meta: {
      otp,
    },
  };
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
      sub: user.id?.toString(),
      exp: addDays(new Date(), 7).getTime(),
    },
    env.JWT_SECRET!,
  );

  const auth = await prisma.userAuth.update({
    where: { id: user.id },
    data: {
      loginOtp: null,
      loginOtpExpiresAt: null,
      lastLoginAt: new Date(),
      accessToken,
    },
    select: {
      authStep: true,
    },
  });

  switch (auth.authStep) {
    case 3:
    case 4:
      return {
        status: "success",
        statusCode: HttpStatus.OK,
        message: "Please complete your profile by providing KYC documents",
        data: {
          nextStep: auth.authStep,
          accessToken,
        },
      };
  }

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "OTP verified successfully",
    data: {
      accessToken,
    },
  };
};

export const testDelete = async (phoneNumber: string) => {
  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

  const user = await prisma.user.findUnique({
    where: {
      phoneNumber: formattedPhoneNumber,
    },
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  await prisma.userAuth.deleteMany({
    where: {
      userId: user.id,
    },
  });

  await prisma.user.delete({
    where: {
      id: user.id,
    },
  });

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "User and associated auth record deleted successfully",
  };
};

export const getUser = async (userId: number) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phoneNumber: true,
      createdAt: true,
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          kycStatus: true,
          showCaseImages: true,
          socials: true,
          category: true,
          trustScore: true,
          description: true,
          createdAt: true,
          bankDetails: true,
        },
      },
    },
  });

  if (!user) {
    throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
  }

  const data = {
    ...user,
  };

  return {
    status: "success",
    statusCode: HttpStatus.OK,
    message: "User retrieved successfully",
    data: user,
  };
};
