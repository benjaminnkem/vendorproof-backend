import { prisma } from "../config/db";
import { logger } from "../config/logger";
import {
  Prisma,
  Tier,
  TierNames,
  PaymentLinkType,
  PaymentStatus,
} from "../generated/prisma/client";
import { faker } from "@faker-js/faker";

const BUSINESS_ID = 33;
const PAYMENT_COUNT = 30;

const startMonthUtc = new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0));
const endMonthUtc = new Date(Date.UTC(2026, 4, 31, 23, 59, 59, 999));

const randomDateInJanToMay2026 = (): Date => {
  // Restrict days to 1..28 to avoid invalid dates for all months.
  const month = faker.number.int({ min: 0, max: 4 });
  const day = faker.number.int({ min: 1, max: 28 });
  const hour = faker.number.int({ min: 0, max: 23 });
  const minute = faker.number.int({ min: 0, max: 59 });
  const second = faker.number.int({ min: 0, max: 59 });

  return new Date(Date.UTC(2026, month, day, hour, minute, second, 0));
};

const getOrCreateGenericPaymentLinkId = async (
  businessId: number,
): Promise<number> => {
  const existing = await prisma.paymentLink.findFirst({
    where: {
      businessId,
      type: PaymentLinkType.GENERIC,
    },
    select: {
      id: true,
    },
    orderBy: {
      id: "asc",
    },
  });

  if (existing) {
    return existing.id;
  }

  const created = await prisma.paymentLink.create({
    data: {
      businessId,
      type: PaymentLinkType.GENERIC,
      token: `seed-generic-${businessId}-${faker.string.alphanumeric(12)}`,
      description: "Seeded generic payment link",
      isOneTime: false,
      isUsed: false,
    },
    select: {
      id: true,
    },
  });

  return created.id;
};

const runPaymentSeed = async () => {
  const business = await prisma.business.findUnique({
    where: { id: BUSINESS_ID },
    select: { id: true, name: true },
  });

  if (!business) {
    throw new Error(`Business with id ${BUSINESS_ID} was not found.`);
  }

  const paymentLinkId = await getOrCreateGenericPaymentLinkId(BUSINESS_ID);

  const payments = Array.from({ length: PAYMENT_COUNT }, (_, index) => {
    const createdAt = randomDateInJanToMay2026();
    const updatedAt = new Date(
      createdAt.getTime() + faker.number.int({ min: 5, max: 600 }) * 1000,
    );

    return {
      paymentLinkId,
      businessId: BUSINESS_ID,
      buyerName: faker.person.fullName(),
      buyerEmail: faker.internet.email().toLowerCase(),
      amount: faker.number.int({ min: 2500, max: 250000 }),
      isServiceRendered: faker.datatype.boolean(),
      status: PaymentStatus.COMPLETED,
      squadRef: `SEED-33-${Date.now()}-${String(index + 1).padStart(3, "0")}`,
      createdAt,
      updatedAt,
    };
  }).sort(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  );

  const result = await prisma.payment.createMany({
    data: payments,
  });

  console.log(
    `Seeded ${result.count} completed payments for business ${BUSINESS_ID}.`,
  );
  console.log(
    `Date range targeted: ${startMonthUtc.toISOString()} -> ${endMonthUtc.toISOString()}`,
  );
};

export const runSeeds = async () => {
  const tiers: Prisma.TierCreateInput[] = [
    {
      minScore: 0,
      maxScore: 0,
      name: TierNames.UNVERIFIED,
      description: "Unverified tier for businesses with no trust score.",
    },
    {
      minScore: 1,
      maxScore: 39,
      name: TierNames.BRONZE,
      description:
        "Bronze tier for businesses with a trust score between 1 and 39.",
    },
    {
      minScore: 40,
      maxScore: 69,
      name: TierNames.SILVER,
      description:
        "Silver tier for businesses with a trust score between 40 and 69.",
    },
    {
      minScore: 70,
      maxScore: 89,
      name: TierNames.GOLD,
      description:
        "Gold tier for businesses with a trust score between 70 and 89.",
    },
    {
      minScore: 90,
      maxScore: 100,
      name: TierNames.PLATINUM,
      description:
        "Platinum tier for businesses with a trust score between 90 and 100.",
    },
  ];

  const existingTiers = await prisma.tier.findMany();
  if (existingTiers.length === 0) {
    await prisma.tier.createMany({
      data: tiers,
    });
    logger.info("Tiers seeded successfully.");
  } else {
    logger.info("Tiers already exist. Skipping seeding.");
  }

  await runPaymentSeed();
};
