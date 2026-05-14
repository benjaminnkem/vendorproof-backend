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
      maxPaymentLimit: 1000,
    },
    {
      minScore: 1,
      maxScore: 39,
      name: TierNames.BRONZE,
      description:
        "Bronze tier for businesses with a trust score between 1 and 39.",
      maxPaymentLimit: 50000,
    },
    {
      minScore: 40,
      maxScore: 69,
      name: TierNames.SILVER,
      description:
        "Silver tier for businesses with a trust score between 40 and 69.",
      maxPaymentLimit: 150000,
    },
    {
      minScore: 70,
      maxScore: 89,
      name: TierNames.GOLD,
      description:
        "Gold tier for businesses with a trust score between 70 and 89.",
      maxPaymentLimit: 500000,
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
};
