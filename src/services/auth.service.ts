import { CustomError, HttpStatus } from "../@types";
import { prisma } from "../config/db";
import cloudinaryHttpService from "../infra/cloudinary/http-service";
import { SignUpInput } from "../schemas/auth.schema";
import { hashPassword, slugify } from "../utils";

export const signUp = async (payload: SignUpInput) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: payload.email,
    },
    select: {
      id: true,
    },
  });

  if (existingUser) {
    throw new CustomError(HttpStatus.BAD_REQUEST, "Email already exists");
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

  const hashedPassword = await hashPassword(payload.password);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
      },
    });

    await tx.userAuth.create({
      data: {
        userId: user.id,
        password: hashedPassword,
        passwordHistory: [hashedPassword],
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

    return {
      userId: user.id,
      email: user.email,
      businessId: business.id,
    };
  });

  return "OK";
};
