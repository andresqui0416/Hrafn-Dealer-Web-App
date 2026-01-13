import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";
import { generateInventoryItem } from "../lib/prisma/generateInventory";

const prisma = new PrismaClient();

async function main() {
  const password = "devpassword";
  const passwordHash = await hashPassword(password);
  const adminPassword = "admin123";
  const adminPasswordHash = await hashPassword(adminPassword);

  // Create admin users
  const superAdmin = await prisma.admin.upsert({
    where: { email: "admin@hrafn.ai" },
    update: {},
    create: {
      email: "admin@hrafn.ai",
      name: "Super Admin",
      passwordHash: adminPasswordHash,
      role: "super_admin",
      isActive: true,
    },
  });

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

  // Create service kinds
  const cdkGlobal = await prisma.serviceKind.upsert({
    where: { name: "CDK Global" },
    update: {},
    create: {
      name: "CDK Global",
      description: "CDK Global CRM integration service",
    },
  });

  const tekion = await prisma.serviceKind.upsert({
    where: { name: "Tekion" },
    update: {},
    create: {
      name: "Tekion",
      description: "Tekion CRM integration service",
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
      generateInventoryItem(dealer.id, i * 50 + index),
    );
    await prisma.inventoryListing.createMany({
      data: inventoryItems,
    });
  }

  console.log("Seeded:", {
    superAdmin: superAdmin.email,
    user: user.email,
    userName: user.name,
    dealer: dealer.name,
    inventoryCount: 500,
    serviceKinds: [cdkGlobal.name, tekion.name],
  });
  console.log("\n=== Admin Credentials ===");
  console.log("Super Admin Email:", superAdmin.email);
  console.log("Super Admin Password:", adminPassword);
  console.log("========================\n");
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
