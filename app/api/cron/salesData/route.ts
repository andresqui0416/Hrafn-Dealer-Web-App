import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getFISalesData, getFISalesHistoryData } from "@/lib/cdk/cdkDriveGetFISale";
import { storeSalesData } from "@/lib/cdk/storeSalesData";

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

/**
 * Fetch and store bulk sales data (last 31 days)
 */
async function fetchAndStoreBulkData(
  saleDepartmentId: string,
  subscriptionId: string,
  dealerId: string,
  startDate: Date,
  endDate: Date,
  dealerResults: { created: number; updated: number; errors: number; total: number },
): Promise<void> {
  try {
    const recentData = await getFISalesData(
      "bulk",
      saleDepartmentId,
      subscriptionId,
      startDate.toISOString(),
      endDate.toISOString(),
    );
    console.log(`Fetched ${recentData.length} recent records from bulk API`);

    // Store data immediately to avoid memory waste
    if (Array.isArray(recentData) && recentData.length > 0) {
      const recentResults = await storeSalesData(recentData, dealerId);
      dealerResults.created += recentResults.created;
      dealerResults.updated += recentResults.updated;
      dealerResults.errors += recentResults.errors;
      dealerResults.total += recentData.length;
      console.log(
        `Stored recent data: ${recentResults.created} created, ${recentResults.updated} updated, ${recentResults.errors} errors`,
      );
    }
  } catch (error: any) {
    console.error(`Error fetching recent data from bulk API:`, error?.message);
    dealerResults.errors++;
  }
}

/**
 * Fetch and store historical sales data in chunks
 */
async function fetchAndStoreHistoryChunks(
  saleDepartmentId: string,
  subscriptionId: string,
  dealerId: string,
  startDate: Date,
  endDate: Date,
  dealerResults: { created: number; updated: number; errors: number; total: number },
): Promise<void> {
  let currentStart = new Date(startDate);
  const sixMonthsInMs = 6 * 30 * 24 * 60 * 60 * 1000 - 3 * 60 * 60 * 1000; // Approximate 6 months minus 3 hours

  while (currentStart < endDate) {
    const chunkEnd: Date = new Date(
      Math.min(currentStart.getTime() + sixMonthsInMs, endDate.getTime()),
    );

    try {
      const historyData = await getFISalesHistoryData(
        saleDepartmentId,
        subscriptionId,
        currentStart.toISOString(),
        chunkEnd.toISOString(),
      );
      console.log(`Fetched ${historyData.length} historical records in this chunk`);

      // Store data immediately to avoid memory waste
      if (Array.isArray(historyData) && historyData.length > 0) {
        const chunkResults = await storeSalesData(historyData, dealerId);
        dealerResults.created += chunkResults.created;
        dealerResults.updated += chunkResults.updated;
        dealerResults.errors += chunkResults.errors;
        dealerResults.total += historyData.length;
        console.log(
          `Stored chunk: ${chunkResults.created} created, ${chunkResults.updated} updated, ${chunkResults.errors} errors`,
        );
      }
      await prisma.dealerDepartment.update({
        where: { id: saleDepartmentId },
        data: {
          lastSalesDataSyncAt: chunkEnd,
        } as any,
      });
    } catch (error: any) {
      console.error(
        `Error fetching history chunk ${currentStart.toISOString()} to ${chunkEnd.toISOString()}:`,
        error?.message,
      );
      dealerResults.errors++;
      throw error;
    }

    currentStart = new Date(chunkEnd.getTime() + 1); // Move to next chunk
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("Fetching dealer services...");
    const dealerServices = await prisma.dealerService.findMany({
      where: {
        status: "allowed",
				subscriptionId: {
					not: null,
				},
      },
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const allResults = {
      totalProcessed: 0,
      totalCreated: 0,
      totalUpdated: 0,
      totalErrors: 0,
      dealers: [] as Array<{
        dealerId: string;
        dealerName: string;
				dealerServiceId: string;
				orgName: string;
        created: number;
        updated: number;
        errors: number;
        total: number;
      }>,
    };

    for (const dealerService of dealerServices) {
      // Set current time once at the start of each loop iteration
      const now = new Date();
      
      const departments = await prisma.dealerDepartment.findMany({
        where: {
          serviceId: dealerService.id,
        },
        select: {
          id: true,
          dmsType: true,
          salesDataSyncInProgress: true,
          salesDataSyncStartedAt: true,
          lastSalesDataSyncAt: true,
        } as any,
      });

      const saleDepartment = departments.find((department: any) => department.dmsType === "Finance");
      if (saleDepartment?.id) {
        try {
          // Check if sync is in progress
          const syncInProgress = (saleDepartment as any).salesDataSyncInProgress as boolean;
          const syncStartedAt = (saleDepartment as any).salesDataSyncStartedAt as Date | null | undefined;

          // If sync is in progress, check if it's been running too long (timeout after 30 minutes)
          const SYNC_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
          if (syncInProgress && syncStartedAt) {
            const syncDuration = now.getTime() - syncStartedAt.getTime();
            if (syncDuration < SYNC_TIMEOUT_MS) {
              console.log(
                `Sync already in progress for dealer ${dealerService.dealer.name} (started ${Math.round(syncDuration / 1000)}s ago), skipping...`,
              );
              continue;
            } else {
              // Sync has been running too long, assume it crashed - will acquire lock below
              console.warn(
                `Sync for dealer ${dealerService.dealer.name} has been running for ${Math.round(syncDuration / 1000)}s (timeout), acquiring lock...`,
              );
            }
          }
          
          const lastSyncAt = (saleDepartment as any).lastSalesDataSyncAt as Date | null | undefined;

          // Acquire lock: set sync in progress flag
          await prisma.dealerDepartment.update({
            where: { id: saleDepartment.id },
            data: {
              salesDataSyncInProgress: true,
              salesDataSyncStartedAt: now,
            } as any,
          });

          const historyEndDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
          // Bulk API requires end date to be at least 60 minutes ago
          const bulkEndDate = new Date(now.getTime() - 60 * 60 * 1000);

          
          const fiveYearsAgo = new Date(now);
          const targetYear = now.getFullYear() - 5;
          const targetMonth = now.getMonth();
          const targetDate = now.getDate();
          // setFullYear handles Feb 29th edge case: if target year is not a leap year, it adjusts to Feb 28
          fiveYearsAgo.setFullYear(targetYear, targetMonth, targetDate);
          const startDate = lastSyncAt ||  fiveYearsAgo;
          let dealerResults = {
            created: 0,
            updated: 0,
            errors: 0,
            total: 0,
          };

          if(startDate <=historyEndDate) {
            await fetchAndStoreHistoryChunks(
              saleDepartment.id,
              dealerService.subscriptionId as string,
              dealerService.dealerId,
              startDate,
              historyEndDate,
              dealerResults,
            );
          }

          await fetchAndStoreBulkData(
            saleDepartment.id,
            dealerService.subscriptionId as string,
            dealerService.dealerId,
            new Date(Math.max(startDate.getTime(), historyEndDate.getTime())),
            bulkEndDate,
            dealerResults,
          );
          
          // Update last sync time and release lock after sync completion
          await prisma.dealerDepartment.update({
            where: { id: saleDepartment.id },
            data: {
              lastSalesDataSyncAt: bulkEndDate.toISOString(),
              salesDataSyncInProgress: false,
              salesDataSyncStartedAt: null,
            } as any,
          });

          // Add dealer results to overall results
          allResults.totalProcessed += dealerResults.total;
          allResults.totalCreated += dealerResults.created;
          allResults.totalUpdated += dealerResults.updated;
          allResults.totalErrors += dealerResults.errors;

          allResults.dealers.push({
            dealerId: dealerService.dealerId,
            dealerName: dealerService.dealer.name,
            dealerServiceId: dealerService.id,
            orgName: dealerService.orgName,
            created: dealerResults.created,
            updated: dealerResults.updated,
            errors: dealerResults.errors,
            total: dealerResults.total,
          });

          console.log(
            `Completed sync for dealer ${dealerService.dealer.name}: ${dealerResults.created} created, ${dealerResults.updated} updated, ${dealerResults.errors} errors.`,
          );
        } catch (error: any) {
          console.error(
            `Error processing sales data for dealer ${dealerService.dealer.name} (${dealerService.dealerId}):`,
            error?.message,
          );
          // Release lock on error
          try {
            await prisma.dealerDepartment.update({
              where: { id: saleDepartment.id },
              data: {
                salesDataSyncInProgress: false,
                salesDataSyncStartedAt: null,
              } as any,
            });
          } catch (lockError: any) {
            console.error(`Error releasing lock for department ${saleDepartment.id}:`, lockError?.message);
          }
          allResults.totalErrors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      results: allResults,
    });
  } catch (error: any) {
    console.error("Error fetching sales data:", error?.message);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}