import { PrismaClient, $Enums } from "@prisma/client";
import crypto from "crypto";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const dealer = await prisma.dealer.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Dev Dealer",
    },
  });

  const password = "devpassword";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: "dev@dealer.test" },
    update: {},
    create: {
      email: "dev@dealer.test",
      passwordHash,
    },
  });

  await prisma.userDealerRole.upsert({
    where: {
      userId_dealerId_role: { userId: user.id, dealerId: dealer.id, role: $Enums.Role.admin },
    },
    update: {},
    create: {
      userId: user.id,
      dealerId: dealer.id,
      role: $Enums.Role.admin,
    },
  });

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      dealerId: dealer.id,
      jwtId: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
    },
  });

  console.log("Seeded:", { dealer, user, session });
}

main()
  .catch((e) => {
    console.log("Error seeding database");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
