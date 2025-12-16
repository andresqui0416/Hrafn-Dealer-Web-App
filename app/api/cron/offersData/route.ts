import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { scrapeOffersFromAudi } from "@/lib/offers/audi";
import { scrapeOffersFromMazda } from "@/lib/offers/mazdausa";
import { scrapeOffersFromMBUSA } from "@/lib/offers/mbusa";
import { scrapeOffersFromLucid } from "@/lib/offers/lucid";
import { scrapeOffersFromHyundai } from "@/lib/offers/hyundai";
import { scrapeOffersFromKia } from "@/lib/offers/kia";

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
      mbusa: { success: false, totalOffers: 0, error: "" },
      lucid: { success: false, totalOffers: 0, error: "" },
      hyundai: { success: false, totalOffers: 0, error: "" },
      kia: { success: false, totalOffers: 0, error: "" },
    };

    // Scrape Audi offers
    try {
      const audiResult = (await scrapeOffersFromAudi()) as {
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
      const mazdaResult = (await scrapeOffersFromMazda()) as {
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

    // Scrape Mercedes-Benz offers
    try {
      const mbusaResult = (await scrapeOffersFromMBUSA()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.mbusa = {
        success: mbusaResult.success,
        totalOffers: mbusaResult.totalOffers || 0,
        error: mbusaResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Mercedes-Benz offers:", error?.message || error);
      results.mbusa.error = error?.message || "Failed to scrape Mercedes-Benz offers";
    }

    // Scrape Lucid offers
    try {
      const lucidResult = (await scrapeOffersFromLucid()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.lucid = {
        success: lucidResult.success,
        totalOffers: lucidResult.totalOffers || 0,
        error: lucidResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Lucid offers:", error?.message || error);
      results.lucid.error = error?.message || "Failed to scrape Lucid offers";
    }

    // Scrape Hyundai offers
    try {
      const hyundaiResult = (await scrapeOffersFromHyundai()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.hyundai = {
        success: hyundaiResult.success,
        totalOffers: hyundaiResult.totalOffers || 0,
        error: hyundaiResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Hyundai offers:", error?.message || error);
      results.hyundai.error = error?.message || "Failed to scrape Hyundai offers";
    }

    // Scrape Kia offers
    try {
      const kiaResult = (await scrapeOffersFromKia()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.kia = {
        success: kiaResult.success,
        totalOffers: kiaResult.totalOffers || 0,
        error: kiaResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Kia offers:", error?.message || error);
      results.kia.error = error?.message || "Failed to scrape Kia offers";
    }

    const totalOffers =
      results.audi.totalOffers +
      results.mazda.totalOffers +
      results.mbusa.totalOffers +
      results.lucid.totalOffers +
      results.hyundai.totalOffers +
      results.kia.totalOffers;
    const allSuccess =
      results.audi.success &&
      results.mazda.success &&
      results.mbusa.success &&
      results.lucid.success &&
      results.hyundai.success &&
      results.kia.success;

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
