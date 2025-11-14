import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { hashPassword } from "../lib/auth/password";
import { generateInventoryItem } from "../lib/prisma/generateInventory";

const prisma = new PrismaClient();

async function main() {
  const password = "devpassword";
  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email: "dev@dealer.test" },
    update: {},
    create: {
      email: "dev@dealer.test",
      name: "Dev User",
      passwordHash,
    },
  });

  await prisma.userApp.deleteMany();
  // Create or get the default app
  const app = await prisma.userApp.create({
    data: {
      userId: user.id,
      name: "Default App",
      description: "Default app created for existing inventory",
      fortellisClientId: "dev-client-id",
      fortellisClientSecret: "dev-client-secret",
    },
  });

  // Delete existing inventory for this user (for re-seeding)
  await prisma.inventoryListing.deleteMany({
    where: { userId: user.id },
  });

  // Create 500 inventory listings
  console.log("Creating inventory listings...");
  for (let i = 0; i < 10; i++) {
    const inventoryItems = Array.from({ length: 50 }, (_, index) =>
      generateInventoryItem(user.id, app.id, i * 50 + index),
    );
    await prisma.inventoryListing.createMany({
      data: inventoryItems,
    });
  }

  console.log("Seeded:", {
    user: user.email,
    userName: user.name,
    app: app.name,
    inventoryCount: 500,
  });
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
