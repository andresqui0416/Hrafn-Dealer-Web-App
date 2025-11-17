import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getFISalesBulkData } from "@/lib/cdk/cdkDriveGetFISale";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// Verify API key for cron job authentication
function verifyApiKey(request: NextRequest): boolean {
  const apiKey =
    request.headers.get("x-api-key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  const expectedKey = process.env.CRON_API_KEY || process.env.INVENTORY_SYNC_API_KEY;

  if (!expectedKey) {
    console.warn("No API key configured for inventory sync");
    return false;
  }

  return apiKey === expectedKey;
}

/**
 * Transform CDK FI Sales inventory data to match our schema
 * Based on CDK Drive FI Sales API YAML specification
 * Response structure: { data: [{ vehicle: {...}, deal: {...}, ... }] }
 */
function transformCDKInventoryItem(cdkItem: any, dealerId: string, appId: string) {
  // Extract vehicle data - CDK FI Sales response has vehicle nested in each item
  const vehicle = cdkItem.vehicle || cdkItem;
  const deal = cdkItem.deal || cdkItem;

  return {
    dealerId,
    appId,
    // Vehicle identification - from vehicle.vin
    vin: vehicle.vin || "",
    // Vehicle year - from vehicle.year (integer)
    year: vehicle.year || 0,
    // Make - prefer makeName (full name) over make (abbreviation)
    make: vehicle.makeName || vehicle.make || "",
    // Model - prefer modelName (full name) over model (abbreviation)
    model: vehicle.modelName || vehicle.model || "",
    // Trim - from modelType or trim fields
    trim: vehicle.modelType || vehicle.trim || cdkItem.trim || cdkItem.Trim || cdkItem.trimLevel || null,
    // Body style - from vehicle.bodyStyle
    bodyStyle: vehicle.bodyStyle || cdkItem.bodyStyle || cdkItem.body_style || cdkItem.BodyStyle || null,
    // Drivetrain - not in FI Sales schema, try to extract if available
    drivetrain: vehicle.drivetrain || cdkItem.drivetrain || cdkItem.driveTrain || cdkItem.Drivetrain || null,
    // MSRP - from deal.msrp or vehicle cost
    msrp: deal.msrp || vehicle.glVehicleCost || cdkItem.msrp || cdkItem.MSRP || cdkItem.manufacturerSuggestedRetailPrice
      ? new Decimal(deal.msrp || vehicle.glVehicleCost || cdkItem.msrp || cdkItem.MSRP || cdkItem.manufacturerSuggestedRetailPrice)
      : null,
    // Price - from deal.cashPrice or outTheDoorPrice
    price: deal.cashPrice || deal.outTheDoorPrice
      ? new Decimal(deal.cashPrice || deal.outTheDoorPrice)
      : null,
    // Mileage - from vehicle.vehicleMileage (integer)
    mileage: vehicle.vehicleMileage || 0,
    // Status - determine from deal status or default to available
    // FI Sales typically has status 'F' for finalized, but for inventory we want available/sold
    status: deal.dealStatus === "F" ? "sold" : (cdkItem.status || cdkItem.Status || cdkItem.availabilityStatus || "available"),
    scrapedAt: new Date(),
  };
}

// Upsert inventory items
async function upsertInventoryItems(items: any[], dealerId: string, appId: string) {
  const results = {
    created: 0,
    updated: 0,
    errors: 0,
  };

  for (const item of items) {
    try {
      const transformed = transformCDKInventoryItem(item, dealerId, appId);

      // Validate required fields
      if (!transformed.vin || !transformed.year || !transformed.make || !transformed.model) {
        console.warn(`Skipping invalid inventory item: missing required fields`, transformed);
        results.errors++;
        continue;
      }

      // Check if item exists before upserting
      const existing = await prisma.inventoryListing.findUnique({
        where: {
          dealerId_vin: {
            dealerId: transformed.dealerId,
            vin: transformed.vin,
          },
        },
      });

      await prisma.inventoryListing.upsert({
        where: {
          dealerId_vin: {
            dealerId: transformed.dealerId,
            vin: transformed.vin,
          },
        },
        update: {
          year: transformed.year,
          make: transformed.make,
          model: transformed.model,
          trim: transformed.trim,
          bodyStyle: transformed.bodyStyle,
          drivetrain: transformed.drivetrain,
          msrp: transformed.msrp,
          price: transformed.price,
          mileage: transformed.mileage,
          status: transformed.status,
          scrapedAt: transformed.scrapedAt,
          updatedAt: new Date(),
        },
        create: transformed,
      });

      if (existing) {
        results.updated++;
      } else {
        results.created++;
      }
    } catch (error) {
      console.error(`Error upserting inventory item:`, error);
      results.errors++;
    }
  }

  return results;
}

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    // Support both dealerId directly or userId (get dealer from user)
    const dealerIdParam = body.dealerId || request.headers.get("x-dealer-id");
    const userIdParam = body.userId || request.headers.get("x-user-id");
    const appId = body.appId || request.headers.get("x-app-id");

    let dealerId: string;

    if (dealerIdParam) {
      // Direct dealerId provided
      dealerId = dealerIdParam;
    } else if (userIdParam) {
      // userId provided - get dealer from user
      const user = await prisma.user.findUnique({
        where: { id: userIdParam },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Get user's dealer
      const userDealerRole = await prisma.userDealerRole.findFirst({
        where: { userId: userIdParam },
        select: { dealerId: true },
        orderBy: { createdAt: "asc" },
      });

      if (!userDealerRole) {
        return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
      }

      dealerId = userDealerRole.dealerId;
    } else {
      return NextResponse.json(
        { error: "dealerId or userId is required in body or x-dealer-id/x-user-id header" },
        { status: 400 }
      );
    }

    // Verify dealer exists
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!dealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    // Get or create app for the dealer
    let app;
    if (appId) {
      app = await prisma.dealerApp.findFirst({
        where: {
          id: appId,
          dealerId,
        },
      });
      if (!app) {
        return NextResponse.json({ error: "App not found or does not belong to dealer" }, { status: 404 });
      }
    } else {
      // Use first app or create a default app
      app = await prisma.dealerApp.findFirst({
        where: { dealerId },
        orderBy: { createdAt: "asc" },
      });
      
      if (!app) {
        // Create a default app for the dealer
        app = await prisma.dealerApp.create({
          data: {
            dealerId,
            name: "Default App",
            description: "Default app created for inventory sync",
            crmType: "CDK",
            clientId: "default-client-id",
            clientSecret: "default-client-secret",
          },
        });
        console.log(`Created default app for dealer: ${app.id}`);
      }
    }

    console.log(`Starting inventory sync for dealer: ${dealer.name} (${dealerId}), app: ${app.name} (${app.id})`);

    // Get department ID from request if provided
    const departmentId = body.departmentId || request.headers.get("x-dept-id");

    // Fetch inventory from CDK
    const cdkInventory = await getFISalesBulkData(departmentId || undefined);

    if (!Array.isArray(cdkInventory) || cdkInventory.length === 0) {
      console.warn(`No inventory items returned from CDK for dealer ${dealerId}`);
      return NextResponse.json({
        success: true,
        message: "No inventory items to sync",
        results: {
          created: 0,
          updated: 0,
          errors: 0,
          total: 0,
        },
      });
    }

    console.log(`Fetched ${cdkInventory.length} items from CDK`);

    // Upsert inventory items
    const results = await upsertInventoryItems(cdkInventory, dealerId, app.id);

    console.log(
      `Inventory sync completed: ${results.created} created, ${results.updated} updated, ${results.errors} errors`
    );

    return NextResponse.json({
      success: true,
      message: "Inventory sync completed",
      results: {
        ...results,
        total: cdkInventory.length,
      },
    });
  } catch (error) {
    console.error("Inventory sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// Also support GET for simple cron job calls
export async function GET(request: NextRequest) {
  try {
    // Verify API key
    if (!verifyApiKey(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Support both dealerId directly or userId (get dealer from user)
    const dealerIdParam = request.nextUrl.searchParams.get("dealerId") || request.headers.get("x-dealer-id");
    const userIdParam = request.nextUrl.searchParams.get("userId") || request.headers.get("x-user-id");
    const appId = request.nextUrl.searchParams.get("appId") || request.headers.get("x-app-id");

    let dealerId: string;

    if (dealerIdParam) {
      // Direct dealerId provided
      dealerId = dealerIdParam;
    } else if (userIdParam) {
      // userId provided - get dealer from user
      const user = await prisma.user.findUnique({
        where: { id: userIdParam },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Get user's dealer
      const userDealerRole = await prisma.userDealerRole.findFirst({
        where: { userId: userIdParam },
        select: { dealerId: true },
        orderBy: { createdAt: "asc" },
      });

      if (!userDealerRole) {
        return NextResponse.json({ error: "No dealer found for user" }, { status: 404 });
      }

      dealerId = userDealerRole.dealerId;
    } else {
      return NextResponse.json(
        { error: "dealerId or userId is required as query parameter or x-dealer-id/x-user-id header" },
        { status: 400 }
      );
    }

    // Verify dealer exists
    const dealer = await prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!dealer) {
      return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
    }

    // Get or create app for the dealer
    let app;
    if (appId) {
      app = await prisma.dealerApp.findFirst({
        where: {
          id: appId,
          dealerId,
        },
      });
      if (!app) {
        return NextResponse.json({ error: "App not found or does not belong to dealer" }, { status: 404 });
      }
    } else {
      // Use first app or create a default app
      app = await prisma.dealerApp.findFirst({
        where: { dealerId },
        orderBy: { createdAt: "asc" },
      });
      
      if (!app) {
        // Create a default app for the dealer
        app = await prisma.dealerApp.create({
          data: {
            dealerId,
            name: "Default App",
            description: "Default app created for inventory sync",
            crmType: "CDK",
            clientId: "default-client-id",
            clientSecret: "default-client-secret",
          },
        });
        console.log(`Created default app for dealer: ${app.id}`);
      }
    }

    console.log(`Starting inventory sync for dealer: ${dealer.name} (${dealerId}), app: ${app.name} (${app.id})`);

    // Get department ID from request if provided (for GET requests)
    const departmentId = request.nextUrl.searchParams.get("departmentId") || request.headers.get("x-dept-id");

    // Fetch inventory from CDK
    const cdkInventory = await getFISalesBulkData(departmentId || undefined);

    if (!Array.isArray(cdkInventory) || cdkInventory.length === 0) {
      console.warn(`No inventory items returned from CDK for dealer ${dealerId}`);
      return NextResponse.json({
        success: true,
        message: "No inventory items to sync",
        results: {
          created: 0,
          updated: 0,
          errors: 0,
          total: 0,
        },
      });
    }

    console.log(`Fetched ${cdkInventory.length} items from CDK`);

    // Upsert inventory items
    const results = await upsertInventoryItems(cdkInventory, dealerId, app.id);

    console.log(
      `Inventory sync completed: ${results.created} created, ${results.updated} updated, ${results.errors} errors`
    );

    return NextResponse.json({
      success: true,
      message: "Inventory sync completed",
      results: {
        ...results,
        total: cdkInventory.length,
      },
    });
  } catch (error) {
    console.error("Inventory sync error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}