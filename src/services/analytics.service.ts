import { prisma } from "../config/db";

export async function getDashboardAnalytics(businessId: number) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      trustScore: true,
      businessKYCs: true,
    },
  });
}
