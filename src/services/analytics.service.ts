import {
  ActivityAnalytics,
  CustomError,
  DashboardAnalytics,
  HttpStatus,
  ProfileAnalytics,
} from "../@types";
import { prisma } from "../config/db";
import { Business, BusinessKYC, Tier } from "../generated/prisma/client";
import { TierNames, VerificationType } from "../generated/prisma/enums";
import { KYC_WEIGHTS } from "../utils/kyc-scoring";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const roundToTwoDecimals = (value: number): number => {
  return Math.round(value * 100) / 100;
};

const getLastSevenDays = () => {
  const today = new Date();
  const days: Array<{ key: string; day: string; start: Date }> = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setHours(0, 0, 0, 0);
    date.setDate(today.getDate() - index);

    const key = date.toISOString().slice(0, 10);
    days.push({
      key,
      day: WEEKDAY_LABELS[date.getDay()]!,
      start: date,
    });
  }

  return days;
};

const getKycScoreByType = (
  rows: BusinessKYC[],
  verificationType: VerificationType,
): number => {
  const sortedRows = rows
    .filter((row) => row.verificationType === verificationType)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return sortedRows[0]?.score ?? 0;
};

async function calculateBusinessTransactionConsistencyScore(
  businessId: number,
): Promise<number> {
  const transactions = await prisma.payment.findMany({
    where: {
      businessId,
      status: "COMPLETED",
    },
    orderBy: { createdAt: "asc" },
    select: {
      amount: true,
    },
  });

  if (transactions.length === 0) {
    return 0;
  }

  const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);
  const averageVolume = totalVolume / transactions.length;

  const consistencyScore = transactions.reduce((score, tx) => {
    const deviation =
      averageVolume === 0
        ? 0
        : Math.abs(tx.amount - averageVolume) / averageVolume;

    if (deviation < 0.1) {
      return score + 1;
    }

    if (deviation < 0.25) {
      return score + 0.5;
    }

    return score;
  }, 0);

  return roundToTwoDecimals((consistencyScore / transactions.length) * 100);
}

async function calculateKycScores(
  business: Pick<Business, "id" | "trustScore">,
  businessKYCS: BusinessKYC[],
  nextTier: Tier | null,
) {
  const cacScore = getKycScoreByType(businessKYCS, VerificationType.CAC);
  const tinScore = getKycScoreByType(businessKYCS, VerificationType.TIN);

  const documentKycMaxScore = KYC_WEIGHTS.cac + KYC_WEIGHTS.tin;
  const documentKycScore =
    documentKycMaxScore === 0
      ? 0
      : ((cacScore * KYC_WEIGHTS.cac + tinScore * KYC_WEIGHTS.tin) /
          documentKycMaxScore);

  const biometricScore = getKycScoreByType(businessKYCS, VerificationType.SELFIE);

  const transactionsConsistencyScore =
    await calculateBusinessTransactionConsistencyScore(business.id);

  const scoresToNextTier = nextTier
    ? Math.max(0, nextTier.minScore - business.trustScore)
    : 0;

  return {
    document: roundToTwoDecimals(documentKycScore),
    biometric: roundToTwoDecimals(biometricScore),
    transactionsConsistency: roundToTwoDecimals(transactionsConsistencyScore),
    scoresToNextTier: roundToTwoDecimals(scoresToNextTier),
  };
}

async function calculateBusinessWeeklyEarnings(businessId: number) {
  const weekDays = getLastSevenDays();
  const startDate = weekDays[0]?.start;

  if (!startDate) {
    return [];
  }

  const transactions = await prisma.payment.findMany({
    where: {
      businessId,
      status: "COMPLETED",
      createdAt: {
        gte: startDate,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      amount: true,
      createdAt: true,
    },
  });

  const earningsByDate = weekDays.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {});

  transactions.forEach((tx) => {
    const dateKey = tx.createdAt.toISOString().slice(0, 10);
    if (Object.hasOwn(earningsByDate, dateKey)) {
      earningsByDate[dateKey] = (earningsByDate[dateKey] ?? 0) + tx.amount;
    }
  });

  return weekDays.map((item) => {
    return {
      day: item.day,
      earnings: roundToTwoDecimals(earningsByDate[item.key] ?? 0),
    };
  });
}

async function calculateScoreTrajectory(businessId: number) {
  const histories = await prisma.trustScoreHistory.findMany({
    where: { businessId },
    select: {
      score: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const monthFormatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  });

  const monthMap = new Map<string, { month: string; score: number }>();

  histories.forEach((entry) => {
    const monthKey = `${entry.createdAt.getUTCFullYear()}-${entry.createdAt.getUTCMonth()}`;
    monthMap.set(monthKey, {
      month: monthFormatter.format(entry.createdAt),
      score: roundToTwoDecimals(entry.score),
    });
  });

  return Array.from(monthMap.values()).slice(-6);
}

async function getBusinessAnalyticsContext(businessId: number) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      trustScore: true,
      businessKYCs: true,
      tier: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!business) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const nextTier = await prisma.tier.findFirst({
    where: {
      minScore: {
        gt: business.trustScore,
      },
    },
    orderBy: {
      minScore: "asc",
    },
  });

  return {
    business,
    currentTier: business.tier?.name ?? TierNames.UNVERIFIED,
    nextTier,
  };
}

export async function getDashboardAnalytics(businessId: number) {
  const { business, currentTier, nextTier } =
    await getBusinessAnalyticsContext(businessId);

  const { document, biometric, transactionsConsistency, scoresToNextTier } =
    await calculateKycScores(business, business.businessKYCs, nextTier);

  const [earningsSummary, weeklyEarnings, scoreTrajectory, recentOrders] =
    await Promise.all([
      prisma.payment.aggregate({
        where: {
          businessId,
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
      calculateBusinessWeeklyEarnings(businessId),
      calculateScoreTrajectory(businessId),
      prisma.payment.findMany({
        where: {
          businessId,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          buyerName: true,
          amount: true,
          createdAt: true,
          status: true,
        },
      }),
    ]);

  const totalEarnings = earningsSummary._sum.amount ?? 0;
  const totalOrders = earningsSummary._count.id ?? 0;

  const data: DashboardAnalytics = {
    trustScore: roundToTwoDecimals(business.trustScore),
    currentTier,
    ...(nextTier ? { nextTier: nextTier.name } : {}),
    kycScores: {
      document,
      biometric,
      transactionsConsistency,
      scoresToNextTier,
    },
    totalEarnings: roundToTwoDecimals(totalEarnings),
    totalOrders,
    averageMonthlyEarnings: roundToTwoDecimals(totalEarnings / 12),
    disputesCount: 0,
    weeklyEarnings,
    scoreTrajectory,
    recentOrders: recentOrders.map((order) => ({
      buyerName: order.buyerName,
      amount: roundToTwoDecimals(order.amount),
      date: order.createdAt.toISOString(),
      status: order.status,
    })),
  };

  return data;
}

export async function getActivityAnalytics(
  businessId: number,
): Promise<ActivityAnalytics> {
  const businessExists = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      id: true,
    },
  });

  if (!businessExists) {
    throw new CustomError(HttpStatus.NOT_FOUND, "Business not found");
  }

  const weekDays = getLastSevenDays();
  const startDate = weekDays[0]?.start;

  const [
    totalTransactions,
    completedTransactions,
    pendingTransactions,
    failedTransactions,
    completedVolume,
    latestTransaction,
    weekCompletedTransactions,
  ] = await Promise.all([
    prisma.payment.count({ where: { businessId } }),
    prisma.payment.count({ where: { businessId, status: "COMPLETED" } }),
    prisma.payment.count({ where: { businessId, status: "PENDING" } }),
    prisma.payment.count({ where: { businessId, status: "FAILED" } }),
    prisma.payment.aggregate({
      where: {
        businessId,
        status: "COMPLETED",
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.payment.findFirst({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      select: {
        buyerName: true,
        amount: true,
        createdAt: true,
        status: true,
      },
    }),
    startDate
      ? prisma.payment.findMany({
          where: {
            businessId,
            status: "COMPLETED",
            createdAt: { gte: startDate },
          },
          select: {
            amount: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const volumeByDate = weekDays.reduce<Record<string, number>>((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {});

  weekCompletedTransactions.forEach((transaction) => {
    const dateKey = transaction.createdAt.toISOString().slice(0, 10);
    if (Object.hasOwn(volumeByDate, dateKey)) {
      volumeByDate[dateKey] = (volumeByDate[dateKey] ?? 0) + transaction.amount;
    }
  });

  return {
    totalTransactions,
    transactions: {
      buyerName: latestTransaction?.buyerName ?? "",
      amount: roundToTwoDecimals(latestTransaction?.amount ?? 0),
      date: latestTransaction?.createdAt.toISOString() ?? "",
      status: latestTransaction?.status ?? "PENDING",
    },
    dailyVolume: weekDays.map((item) => ({
      day: item.day,
      volume: roundToTwoDecimals(volumeByDate[item.key] ?? 0),
    })),
    totalVolume: roundToTwoDecimals(completedVolume._sum.amount ?? 0),
    completedTransactions,
    pendingTransactions,
    failedTransactions,
  };
}

export async function getProfileAnalytics(
  businessId: number,
): Promise<ProfileAnalytics> {
  const { business, nextTier } = await getBusinessAnalyticsContext(businessId);

  const [{ document, biometric, transactionsConsistency, scoresToNextTier }, completedSummary] =
    await Promise.all([
      calculateKycScores(business, business.businessKYCs, nextTier),
      prisma.payment.aggregate({
        where: {
          businessId,
          status: "COMPLETED",
        },
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

  const totalEarnings = completedSummary._sum.amount ?? 0;
  const totalOrders = completedSummary._count.id ?? 0;

  return {
    totalEarnings: roundToTwoDecimals(totalEarnings),
    totalOrders,
    averageMonthlyEarnings: roundToTwoDecimals(totalEarnings / 12),
    disputesCount: 0,
    kycStatus: {
      document,
      biometric,
      transactionsConsistency,
      scoresToNextTier,
    },
  };
}
