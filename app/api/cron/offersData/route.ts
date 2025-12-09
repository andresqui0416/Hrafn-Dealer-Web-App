import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { scrapeOffersFromAudi } from "@/lib/offers/audi";
import { scrapeOffersFromMazda } from "@/lib/offers/mazdausa";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const prisma = new PrismaClient();

/**
 * Cron endpoint to scrape vehicle incentive/offer data from manufacturer APIs.
 * Extracts public incentive information including:
 * - Date of scrape
 * - Vehicle information (brand, model, year, etc.)
 * - Type of offer (lease, financing, cash, etc.)
 * - Expiration of offer
 * - Terms of offer
 * - Amount of offer
 * 
 * This data is public record and accessible to all users.
 */
export async function GET(_request: NextRequest) {
  try {
    await prisma.$connect();
    
    const results = {
      audi: { success: false, totalOffers: 0, error: "" },
      mazda: { success: false, totalOffers: 0, error: "" },
    };

    // Scrape Audi offers
    try {
      const audiResult = await scrapeOffersFromAudi() as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.audi = {
        success: audiResult.success,
        totalOffers: audiResult.totalOffers || 0,
        error: audiResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Audi offers:", error?.message || error);
      results.audi.error = error?.message || "Failed to scrape Audi offers";
    }

    // Scrape Mazda offers
    try {
      const mazdaResult = await scrapeOffersFromMazda() as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.mazda = {
        success: mazdaResult.success,
        totalOffers: mazdaResult.totalOffers || 0,
        error: mazdaResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Mazda offers:", error?.message || error);
      results.mazda.error = error?.message || "Failed to scrape Mazda offers";
    }

    const totalOffers = results.audi.totalOffers + results.mazda.totalOffers;
    const allSuccess = results.audi.success && results.mazda.success;

    return NextResponse.json({
      success: allSuccess,
      totalOffers,
      details: results,
    });
  } catch (error: any) {
    console.error("Error scraping offers:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "Internal server error while scraping offers" },
      { status: 500 },
    );
  } finally {
    await prisma.$disconnect();
  }
}
