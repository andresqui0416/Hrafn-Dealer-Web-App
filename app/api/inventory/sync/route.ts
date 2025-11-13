import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getFISalesBulkData } from "@/lib/cdk/CDK Drive Get FI Sales";

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
function transformCDKInventoryItem(cdkItem: any, dealerId: string) {
  // Extract vehicle data - CDK FI Sales response has vehicle nested in each item
  const vehicle = cdkItem.vehicle || cdkItem;
  const deal = cdkItem.deal || cdkItem;

  return {
    dealerId,
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
async function upsertInventoryItems(items: any[], dealerId: string) {
  const results = {
    created: 0,
    updated: 0,
    errors: 0,
  };

  for (const item of items) {
    try {
      const transformed = transformCDKInventoryItem(item, dealerId);

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
    const dealerId = body.dealerId || request.headers.get("x-dealer-id");

    if (!dealerId) {
      return NextResponse.json(
        { error: "dealerId is required in body or x-dealer-id header" },
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

    console.log(`Starting inventory sync for dealer: ${dealer.name} (${dealerId})`);

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
    const results = await upsertInventoryItems(cdkInventory, dealerId);

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

    const dealerId = request.nextUrl.searchParams.get("dealerId") || request.headers.get("x-dealer-id");

    if (!dealerId) {
      return NextResponse.json(
        { error: "dealerId is required as query parameter or x-dealer-id header" },
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

    console.log(`Starting inventory sync for dealer: ${dealer.name} (${dealerId})`);

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
    const results = await upsertInventoryItems(cdkInventory, dealerId);

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