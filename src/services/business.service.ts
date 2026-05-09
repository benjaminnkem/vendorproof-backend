import { prisma } from "../config/db";
import { CustomError, HttpStatus } from "../@types";

const getCurrentTier = async (score: number) => {
  return prisma.tier.findFirst({
    where: {
      minScore: { lte: score },
      OR: [{ maxScore: { gte: score } }, { maxScore: null }],
    },
    orderBy: { minScore: "desc" },
  });
};

export const getBusinessById = async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: {
      socials: true,
      trustScoreHistories: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const tier = await getCurrentTier(business.trustScore);

  return { ...business, tier };
};

export const getTrustScore = async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, trustScore: true },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const tier = await getCurrentTier(business.trustScore);

  return { ...business, tier };
};

export const getTrustScoreHistory = async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const history = await prisma.trustScoreHistory.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });

  return {
    history,
  };
};

const buildScoreSummary = (
  score: number,
  positive: { reason: string | null; scoreIncrement: number }[],
  negative: { reason: string | null; scoreIncrement: number }[],
  tierName: string | null,
): string => {
  const parts: string[] = [];

  parts.push(
    `Your current trust score is ${score.toFixed(1)}${tierName ? ` (${tierName} tier)` : ""}.`,
  );

  if (positive.length > 0) {
    parts.push(
      `You have ${positive.length} positive event(s) contributing to your score.`,
    );
  }

  if (negative.length > 0) {
    parts.push(`${negative.length} event(s) have reduced your score recently.`);
    const reasons = negative.map((e) => e.reason).filter(Boolean);
    if (reasons.length > 0) {
      parts.push(`Key reasons: ${reasons.slice(0, 3).join("; ")}.`);
    }
  }

  if (positive.length === 0 && negative.length === 0) {
    parts.push("No trust events have been recorded yet.");
  }

  return parts.join(" ");
};

export const getTrustScoreReason = async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, trustScore: true },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const recentEntries = await prisma.trustEntry.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const tier = await getCurrentTier(business.trustScore);

  const positiveEntries = recentEntries.filter((e) => e.scoreIncrement > 0);
  const negativeEntries = recentEntries.filter((e) => e.scoreIncrement < 0);

  const summary = buildScoreSummary(
    business.trustScore,
    positiveEntries,
    negativeEntries,
    tier?.name ?? null,
  );

  return {
    currentScore: business.trustScore,
    tier: tier ?? null,
    summary,
    recentEntries,
  };
};

export const getAiProfile = async (businessId: number) => {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    include: { socials: true },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const signals: string[] = [];

  if (business.description)
    signals.push(`Description: ${business.description}`);
  if (business.socials.length > 0) {
    signals.push(
      `Active on: ${business.socials.map((s) => s.platform).join(", ")}`,
    );
  }

  return {
    businessId: business.id,
    businessName: business.name,
    signals,
    profile: null,
    note: "AI profile generation pending integration",
  };
};
