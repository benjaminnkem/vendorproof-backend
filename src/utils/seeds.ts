import { prisma } from "../config/db";
import { logger } from "../config/logger";
import { Prisma, Tier, TierNames } from "../generated/prisma/client";

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

  // seed transactions
  const businesses = await prisma.business.findMany();
  const transactions: Prisma.PaymentCreateInput[] = [];

  for (const business of businesses) {
    for (let i = 0; i < 5; i++) {
      transactions.push({
        amount: Math.floor(Math.random() * 1000) + 1,
        business: { connect: { id: business.id } },
        status: "COMPLETED",
        createdAt: new Date(),
        buyerEmail: `buyer${Math.floor(Math.random() * 1000)}@example.com`,
        buyerName: `Buyer ${Math.floor(Math.random() * 1000)}`,
        paymentLink: {
          create: {
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // expires in 7 days
            type: `QUICK`,
            business: { connect: { id: business.id } },
            token: `token_${Math.random().toString(36).substring(2, 15)}`,
          },
        },
        squadRef: `squad_${Math.random().toString(36).substring(2, 15)}`,
      });

      await prisma.payment.create({
        data: transactions[transactions.length - 1]!,
      });
    }
  }

  logger.info("Transactions seeded successfully.");
};
