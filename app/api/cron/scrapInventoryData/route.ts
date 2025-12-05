import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

async function scrapeInventory(totalInventory: number, pageLimit: number, pageOffset: number) {
  try {
    const headers = new Headers();
    headers.append("apollographql-client-name", "fa-vlp-list-page");
    headers.append("apollographql-client-version", "5.17.4");
    headers.append("Content-Type", "application/json");

    const body = JSON.stringify({
      operationName: "StockCarSearch",
      variables: {
        stockIdentifier: {
          marketIdentifier: {
            brand: "A",
            country: "us",
            language: "en",
          },
          stockCarsType: "NEW",
        },
        searchParameter: {
          geo: {
            latitude: 40.75368539999999,
            longitude: -73.9991637,
            maxDistance: 5000,
          },
          paging: {
            limit: pageLimit,
            offset: pageOffset,
          },
          sort: {
            id: "BY_DISTANCE",
            direction: "ASC",
          },
          criteria: [
            {
              id: "stat-import",
              items: ["AGC_USA_JDP"],
            },
            {
              id: "available-from-code",
              items: ["now"],
            },
            {
              id: "sold-order",
              items: ["no"],
            },
          ],
        },
        groupIds: ["renderImagesPNG", "dealerImages"],
        imageIds: ["sc5c01", "vtp4x3n3c", "vtp4x3n5c", "1", "2", "3"],
      },
      query:
        "query StockCarSearch($stockIdentifier: StockIdentifierInput!, $searchParameter: StockCarSearchParameterInput, $groupIds: [String!], $imageIds: [String!]) {\n  stockCarSearch(\n    stockIdentifier: $stockIdentifier\n    searchParameter: $searchParameter\n  ) {\n    resultNumber\n    search {\n      criteria {\n        id\n        possibleItems {\n          id\n          number\n          __typename\n        }\n        selectedItems {\n          id\n          number\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    results {\n      sort {\n        id\n        direction\n        __typename\n      }\n      paging {\n        limit\n        offset\n        __typename\n      }\n      cars {\n        geoDistance {\n          unitText\n          value {\n            formatted\n            number\n            __typename\n          }\n          __typename\n        }\n        stockCar {\n          code {\n            id\n            __typename\n          }\n          id\n          vin\n          weblink\n          titleText\n          model {\n            name\n            salesModelyear\n            id {\n              code\n              __typename\n            }\n            __typename\n          }\n          modelInfo {\n            genericModel {\n              code\n              text\n              __typename\n            }\n            modelyear\n            __typename\n          }\n          dealer {\n            id\n            name\n            region\n            __typename\n          }\n          carPrices {\n            label\n            price {\n              value\n              valueAsText\n              formattedValue\n              __typename\n            }\n            type\n            __typename\n          }\n          salesInfo {\n            availableFromDateInfo {\n              type\n              value\n              __typename\n            }\n            orderStatusText\n            saleOrderTypeText\n            __typename\n          }\n          qualityLabel {\n            label\n            __typename\n          }\n          subtitleText\n          cartypeText\n          preUse {\n            code\n            text\n            __typename\n          }\n          commissionNumber\n          images(groupIds: $groupIds, imageIds: $imageIds) {\n            url\n            type\n            mimeType\n            id {\n              group\n              image\n              __typename\n            }\n            __typename\n          }\n          colorInfo {\n            exteriorColor {\n              colorInfo {\n                text\n                __typename\n              }\n              baseColorInfo {\n                code\n                text\n                __typename\n              }\n              __typename\n            }\n            interiorColor {\n              colorInfo {\n                text\n                __typename\n              }\n              baseColorInfo {\n                code\n                text\n                __typename\n              }\n              __typename\n            }\n            __typename\n          }\n          driveText\n          dynamicAttributes {\n            id\n            value\n            __typename\n          }\n          engineInfo {\n            fuel {\n              code\n              text\n              __typename\n            }\n            __typename\n          }\n          carline {\n            id\n            name\n            __typename\n          }\n          gearText\n          metaData {\n            statImport\n            __typename\n          }\n          mileage {\n            unitText\n            value {\n              formatted\n              number\n              __typename\n            }\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}",
    });

    const response = await fetch("https://onegraph.audi.com/graphql", {
      method: "POST",
      headers,
      body,
      redirect: "follow",
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("Audi inventory API error:", response.status, text);
      return NextResponse.json(
        { success: false, error: "Audi inventory API request failed" },
        { status: 502 },
      );
    }
    const data = await response.json();

    const inventory = data.data.stockCarSearch.results.cars.map((car: any) => ({
      dealerId: car.stockCar.dealer.id,
      vin: car.stockCar.vin || null,
      year: car.stockCar.model.salesModelyear || null,
      make: car.stockCar.model.name || null,
      model: car.stockCar.model.id.code || null,
      trim: car.stockCar.modelInfo.genericModel.code || null,
      msrp: car.stockCar.carPrices[1]?.price.value || null,
      price: car.stockCar.carPrices[2]?.price.value || null,
      bodyStyle: car.stockCar.cartypeText || null,
      drivetrain: car.stockCar.driveText || null,
      mileage: car.stockCar.mileage.value.number || null,
      status: car.stockCar.salesInfo.orderStatusText || null,
      scrapedAt: new Date(),
    }));

    prisma.$transaction(async (tx) => {
      for (const car of inventory) {
        await tx.inventoryListing.upsert({
          where: { dealerId_vin: { dealerId: car.dealerId, vin: car.vin } },
          update: {
            ...car,
            updatedAt: new Date(),
          },
          create: car,
        });
      }
    });
    pageOffset += pageLimit;
    if (pageOffset < data.data.stockCarSearch.resultNumber) {
      return await scrapeInventory(totalInventory, pageLimit, pageOffset);
    }


    return {success: true, totalInventory: totalInventory + inventory.length};
  } catch (error) {
    console.error("Error scraping Audi inventory:", error);
    return {success: false, error: "Internal server error while scraping Audi inventory"};
  }
}
/**
 * Simple cron endpoint to scrape Audi inventory data from their GraphQL API.
 * For now this uses a fixed geo location and paging; you can later adapt it
 * per-dealer (lat/long, radius, paging, etc.) and persist the results.
 */
export async function GET(_request: NextRequest) {
  try {
    await prisma.$connect();
    let pageLimit = 12;
    let pageOffset = 0;
    const result = await scrapeInventory(0, pageLimit, pageOffset) as {success: boolean, totalInventory?: number | undefined, error?: string | undefined  };
    if (!result.success) {
      throw new Error(result?.error || "Failed to scrape Audi inventory");
    }

    return NextResponse.json({ success: true, totalInventory: result.totalInventory });
  } catch (error: any) {
    console.error("Error scraping Audi inventory:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Internal server error while scraping Audi inventory" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
