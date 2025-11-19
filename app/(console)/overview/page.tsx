"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDollarSign,
  faCar,
  faChartLine,
  faUsers,
  faArrowTrendUp,
  faArrowTrendDown,
} from "@fortawesome/free-solid-svg-icons";
import { cn } from "@/lib/utils";

export default function OverviewPage() {
  // Sample data
  const sampleData = {
    salesToday: {
      amount: 45230,
      change: 12.5,
      trend: "up" as const,
    },
    totalInventory: {
      count: 247,
      change: -3,
      trend: "down" as const,
    },
    totalRevenue: {
      amount: 1250000,
      change: 8.2,
      trend: "up" as const,
    },
    activeCustomers: {
      count: 89,
      change: 5,
      trend: "up" as const,
    },
    averageSalePrice: {
      amount: 28500,
      change: 2.1,
      trend: "up" as const,
    },
    vehiclesSold: {
      count: 156,
      change: 15,
      trend: "up" as const,
    },
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const StatCard = ({
    title,
    value,
    change,
    trend,
    icon,
    formatValue,
  }: {
    title: string;
    value: number;
    change: number;
    trend: "up" | "down";
    icon: any;
    formatValue: (val: number) => string;
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <FontAwesomeIcon icon={icon} className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        <div className="flex items-center text-xs text-muted-foreground mt-1">
          <FontAwesomeIcon
            icon={trend === "up" ? faArrowTrendUp : faArrowTrendDown}
            className={cn(
              "h-3 w-3 mr-1",
              trend === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
            )}
          />
          <span
            className={cn(
              trend === "up" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {Math.abs(change)}% {trend === "up" ? "increase" : "decrease"}
          </span>
          <span className="ml-1">from last period</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Overview</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Sales Today"
          value={sampleData.salesToday.amount}
          change={sampleData.salesToday.change}
          trend={sampleData.salesToday.trend}
          icon={faDollarSign}
          formatValue={formatCurrency}
        />
        <StatCard
          title="Total Inventory"
          value={sampleData.totalInventory.count}
          change={Math.abs(sampleData.totalInventory.change)}
          trend={sampleData.totalInventory.trend}
          icon={faCar}
          formatValue={(val) => val.toString()}
        />
        <StatCard
          title="Total Revenue"
          value={sampleData.totalRevenue.amount}
          change={sampleData.totalRevenue.change}
          trend={sampleData.totalRevenue.trend}
          icon={faChartLine}
          formatValue={formatCurrency}
        />
        <StatCard
          title="Active Customers"
          value={sampleData.activeCustomers.count}
          change={sampleData.activeCustomers.change}
          trend={sampleData.activeCustomers.trend}
          icon={faUsers}
          formatValue={(val) => val.toString()}
        />
        <StatCard
          title="Average Sale Price"
          value={sampleData.averageSalePrice.amount}
          change={sampleData.averageSalePrice.change}
          trend={sampleData.averageSalePrice.trend}
          icon={faDollarSign}
          formatValue={formatCurrency}
        />
        <StatCard
          title="Vehicles Sold"
          value={sampleData.vehiclesSold.count}
          change={sampleData.vehiclesSold.change}
          trend={sampleData.vehiclesSold.trend}
          icon={faCar}
          formatValue={(val) => val.toString()}
        />
      </div>
    </div>
  );
}

