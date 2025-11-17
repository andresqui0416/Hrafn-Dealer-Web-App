import { PrismaClient } from "@prisma/client";
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
      phone: "1234567890",
    },
  });

  await prisma.dealer.deleteMany();
  // Create or get the default dealer
  const dealer = await prisma.dealer.create({
    data: {
      name: "My Dealer",
      address: "123 Main St, City, State 12345",
    },
  });

  // Create user-dealer role relationship
  await prisma.userDealerRole.upsert({
    where: {
      userId_dealerId_role: {
        userId: user.id,
        dealerId: dealer.id,
        role: "admin",
      },
    },
    update: {},
    create: {
      userId: user.id,
      dealerId: dealer.id,
      role: "admin",
    },
  });

  await prisma.dealerApp.deleteMany({
    where: { dealerId: dealer.id },
  });
  // Create or get the default app
  const app = await prisma.dealerApp.create({
    data: {
      dealerId: dealer.id,
      name: "Default App",
      description: "Default app created for existing inventory",
      crmType: "CDK",
      clientId: "dev-client-id",
      clientSecret: "dev-client-secret",
    },
  });

  // Delete existing inventory for this dealer (for re-seeding)
  await prisma.inventoryListing.deleteMany({
    where: { dealerId: dealer.id },
  });

  // Create 500 inventory listings
  console.log("Creating inventory listings...");
  for (let i = 0; i < 10; i++) {
    const inventoryItems = Array.from({ length: 50 }, (_, index) =>
      generateInventoryItem(dealer.id, app.id, i * 50 + index),
    );
    await prisma.inventoryListing.createMany({
      data: inventoryItems,
    });
  }

  console.log("Seeded:", {
    user: user.email,
    userName: user.name,
    dealer: dealer.name,
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
