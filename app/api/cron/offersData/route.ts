import { NextRequest, NextResponse } from "next/server";
import { scrapeOffersFromAudi } from "@/lib/offers/audi";
import { scrapeOffersFromMazda } from "@/lib/offers/mazdausa";
import { scrapeOffersFromMBUSA } from "@/lib/offers/mbusa";
import { scrapeOffersFromLucid } from "@/lib/offers/lucid";
import { scrapeOffersFromHyundai } from "@/lib/offers/hyundai";
import { scrapeOffersFromKia } from "@/lib/offers/kia";
import { scrapeOffersFromCadillac } from "@/lib/offers/cadillac";
import { scrapeOffersFromGMC } from "@/lib/offers/gmc";
import { scrapeOffersFromBuick } from "@/lib/offers/buick";
import { scrapeOffersFromChevrolet } from "@/lib/offers/chevrolet";
import { scrapeOffersFromChrysler } from "@/lib/offers/chrysler";
import { scrapeOffersFromJeep } from "@/lib/offers/jeep";
import { scrapeOffersFromRAM } from "@/lib/offers/ram";
import { scrapeOffersFromDodge } from "@/lib/offers/dodge";
import { scrapeOffersFromPorsche } from "@/lib/offers/porsche";
import { scrapeOffersFromHonda } from "@/lib/offers/honda";
import { scrapeOffersFromBMW } from "@/lib/offers/bmw";
import { scrapeOffersFromVW } from "@/lib/offers/vw";
import { scrapeOffersFromToyota } from "@/lib/offers/toyota";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
export async function GET(_request: NextRequest): Promise<NextResponse> {
  try {
    const results = {
      audi: { success: false, totalOffers: 0, error: "" },
      mazda: { success: false, totalOffers: 0, error: "" },
      mbusa: { success: false, totalOffers: 0, error: "" },
      lucid: { success: false, totalOffers: 0, error: "" },
      hyundai: { success: false, totalOffers: 0, error: "" },
      kia: { success: false, totalOffers: 0, error: "" },
      cadillac: { success: false, totalOffers: 0, error: "" },
      gmc: { success: false, totalOffers: 0, error: "" },
      buick: { success: false, totalOffers: 0, error: "" },
      chevrolet: { success: false, totalOffers: 0, error: "" },
      chrysler: { success: false, totalOffers: 0, error: "" },
      jeep: { success: false, totalOffers: 0, error: "" },
      ram: { success: false, totalOffers: 0, error: "" },
      dodge: { success: false, totalOffers: 0, error: "" },
      porsche: { success: false, totalOffers: 0, error: "" },
      honda: { success: false, totalOffers: 0, error: "" },
      bmw: { success: false, totalOffers: 0, error: "" },
      vw: { success: false, totalOffers: 0, error: "" },
      toyota: { success: false, totalOffers: 0, error: "" },
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

    // Scrape Cadillac offers
    try {
      const cadillacResult = (await scrapeOffersFromCadillac()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.cadillac = {
        success: cadillacResult.success,
        totalOffers: cadillacResult.totalOffers || 0,
        error: cadillacResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Cadillac offers:", error?.message || error);
      results.cadillac.error = error?.message || "Failed to scrape Cadillac offers";
    }

    // Scrape GMC offers
    try {
      const gmcResult = (await scrapeOffersFromGMC()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.gmc = {
        success: gmcResult.success,
        totalOffers: gmcResult.totalOffers || 0,
        error: gmcResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping GMC offers:", error?.message || error);
      results.gmc.error = error?.message || "Failed to scrape GMC offers";
    }

    // Scrap Buick offers
    try {
      const buickResult = (await scrapeOffersFromBuick()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.buick = {
        success: buickResult.success,
        totalOffers: buickResult.totalOffers || 0,
        error: buickResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Buick offers:", error?.message || error);
      results.buick.error = error?.message || "Failed to scrape Buick offers";
    }

    // Scrape Chevrolet offers
    try {
      const chevroletResult = (await scrapeOffersFromChevrolet()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.chevrolet = {
        success: chevroletResult.success,
        totalOffers: chevroletResult.totalOffers || 0,
        error: chevroletResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Chevrolet offers:", error?.message || error);
      results.chevrolet.error = error?.message || "Failed to scrape Chevrolet offers";
    }

    // Scrape Chrysler offers
    try {
      const chryslerResult = (await scrapeOffersFromChrysler()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.chrysler = {
        success: chryslerResult.success,
        totalOffers: chryslerResult.totalOffers || 0,
        error: chryslerResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Chrysler offers:", error?.message || error);
      results.chrysler.error = error?.message || "Failed to scrape Chrysler offers";
    }

    // Scrape Jeep offers
    try {
      const jeepResult = (await scrapeOffersFromJeep()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.jeep = {
        success: jeepResult.success,
        totalOffers: jeepResult.totalOffers || 0,
        error: jeepResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Jeep offers:", error?.message || error);
      results.jeep.error = error?.message || "Failed to scrape Jeep offers";
    }

    // Scrape RAM offers
    try {
      const ramResult = (await scrapeOffersFromRAM()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.ram = {
        success: ramResult.success,
        totalOffers: ramResult.totalOffers || 0,
        error: ramResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping RAM offers:", error?.message || error);
      results.ram.error = error?.message || "Failed to scrape RAM offers";
    }

    // Scrape Dodge offers
    try {
      const dodgeResult = (await scrapeOffersFromDodge()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.dodge = {
        success: dodgeResult.success,
        totalOffers: dodgeResult.totalOffers || 0,
        error: dodgeResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Dodge offers:", error?.message || error);
      results.dodge.error = error?.message || "Failed to scrape Dodge offers";
    }

    // Scrape Porsche offers
    try {
      const porscheResult = (await scrapeOffersFromPorsche()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.porsche = {
        success: porscheResult.success,
        totalOffers: porscheResult.totalOffers || 0,
        error: porscheResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Porsche offers:", error?.message || error);
      results.porsche.error = error?.message || "Failed to scrape Porsche offers";
    }

    // Scrape Honda offers
    try {
      const hondaResult = (await scrapeOffersFromHonda()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.honda = {
        success: hondaResult.success,
        totalOffers: hondaResult.totalOffers || 0,
        error: hondaResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Honda offers:", error?.message || error);
      results.honda.error = error?.message || "Failed to scrape Honda offers";
    }

    // Scrape BMW offers
    try {
      const bmwResult = (await scrapeOffersFromBMW()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.bmw = {
        success: bmwResult.success,
        totalOffers: bmwResult.totalOffers || 0,
        error: bmwResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping BMW offers:", error?.message || error);
      results.bmw.error = error?.message || "Failed to scrape BMW offers";
    }

    // Scrape Volkswagen offers
    try {
      const vwResult = (await scrapeOffersFromVW()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.vw = {
        success: vwResult.success,
        totalOffers: vwResult.totalOffers || 0,
        error: vwResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Volkswagen offers:", error?.message || error);
      results.vw.error = error?.message || "Failed to scrape Volkswagen offers";
    }

    // Scrape Toyota offers
    try {
      const toyotaResult = (await scrapeOffersFromToyota()) as {
        success: boolean;
        totalOffers?: number;
        error?: string;
      };
      results.toyota = {
        success: toyotaResult.success,
        totalOffers: toyotaResult.totalOffers || 0,
        error: toyotaResult.error || "",
      };
    } catch (error: any) {
      console.error("Error scraping Toyota offers:", error?.message || error);
      results.toyota.error = error?.message || "Failed to scrape Toyota offers";
    }

    const totalOffers =
      results.audi.totalOffers +
      results.mazda.totalOffers +
      results.mbusa.totalOffers +
      results.lucid.totalOffers +
      results.hyundai.totalOffers +
      results.kia.totalOffers +
      results.cadillac.totalOffers +
      results.gmc.totalOffers +
      results.buick.totalOffers +
      results.chevrolet.totalOffers +
      results.chrysler.totalOffers +
      results.jeep.totalOffers +
      results.ram.totalOffers +
      results.dodge.totalOffers +
      results.porsche.totalOffers +
      results.honda.totalOffers +
      results.bmw.totalOffers +
      results.vw.totalOffers +
      results.toyota.totalOffers;

    const allSuccess =
      results.audi.success &&
      results.mazda.success &&
      results.mbusa.success &&
      results.lucid.success &&
      results.hyundai.success &&
      results.kia.success &&
      results.cadillac.success &&
      results.gmc.success &&
      results.buick.success &&
      results.chevrolet.success &&
      results.chrysler.success &&
      results.jeep.success &&
      results.ram.success &&
      results.dodge.success &&
      results.porsche.success &&
      results.honda.success &&
      results.bmw.success &&
      results.vw.success &&
      results.toyota.success;

    return NextResponse.json({
      success: allSuccess,
      totalOffers,
      details: results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error scraping offers:", message);
    return NextResponse.json(
      { success: false, error: "Internal server error while scraping offers" },
      { status: 500 },
    );
  }
}
