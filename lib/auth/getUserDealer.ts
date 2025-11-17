import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get the user's primary dealer (first dealer they have a role for)
 * If multiple dealers exist, returns the first one
 */
export async function getUserDealer(userId: string): Promise<string | null> {
  const userDealerRole = await prisma.userDealerRole.findFirst({
    where: { userId },
    select: { dealerId: true },
    orderBy: { createdAt: "asc" },
  });

  return userDealerRole?.dealerId || null;
}

/**
 * Get all dealers for a user
 */
export async function getUserDealers(userId: string): Promise<string[]> {
  const userDealerRoles = await prisma.userDealerRole.findMany({
    where: { userId },
    select: { dealerId: true },
  });

  return userDealerRoles.map((role) => role.dealerId);
}

