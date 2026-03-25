"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react"

type SectionCardStats = {
  products: number
  categories: number
  batches: number
  sales: number
  totalProfit: number
  profitChangePercent: number
  profitTrend: "up" | "down" | "stable"
  totalStock: number
}

export function SectionCards({ stats }: { stats?: SectionCardStats }) {
  const profitTrend = stats?.profitTrend ?? "stable"
  const profitChangePercent = stats?.profitChangePercent ?? 0
  const formattedProfitChange = `${Math.abs(profitChangePercent).toFixed(1)}%`

  const profitBadgeClass =
    profitTrend === "up"
      ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900/60 dark:bg-emerald-950/20"
      : profitTrend === "down"
        ? "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900/60 dark:bg-red-950/20"
        : "text-slate-600 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-700 dark:bg-slate-900"

  const ProfitTrendIcon =
    profitTrend === "up" ? TrendingUpIcon : profitTrend === "down" ? TrendingDownIcon : TrendingUpIcon

  return (
    <div className="grid grid-cols-3 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
      <Card className="@container/card border-0 shadow-none">
        <CardHeader>
          <CardDescription>Products</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats?.products ?? 0}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon
              />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total product records{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Inventory catalog size
          </div>
        </CardFooter>
      </Card>
      {/* <Card className="@container/card border-0 shadow-none">
        <CardHeader>
          <CardDescription>Categories</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats?.categories ?? 0}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingDownIcon
              />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Product grouping coverage{" "}
            <TrendingDownIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Active category definitions
          </div>
        </CardFooter>
      </Card> */}
      <Card className="@container/card border-0 shadow-none">
        <CardHeader>
          <CardDescription>Batches</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {stats?.batches ?? 0}
          </CardTitle>
          <CardAction>
            <Badge variant="outline">
              <TrendingUpIcon
              />
              Live
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Total shipment batches{" "}
            <TrendingUpIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Imported inventory groups</div>
        </CardFooter>
      </Card>
      <Card className="@container/card border-0 shadow-none">
        <CardHeader>
          <CardDescription>Total Profit</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {(stats?.totalProfit ?? 0).toLocaleString()} RWF
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className={profitBadgeClass}>
              <ProfitTrendIcon />
              {formattedProfitChange}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div
            className={`line-clamp-1 flex gap-2 font-medium ${profitTrend === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : profitTrend === "down"
                  ? "text-red-600 dark:text-red-400"
                  : "text-slate-600 dark:text-slate-300"
              }`}
          >
            {profitTrend === "up"
              ? `Profit increased by ${formattedProfitChange} vs last 7 days`
              : profitTrend === "down"
                ? `Profit decreased by ${formattedProfitChange} vs last 7 days`
                : "Profit is stable vs last 7 days"}{" "}
            <ProfitTrendIcon className="size-4" />
          </div>
          <div className="text-muted-foreground">Net unit profit x sold quantity</div>
        </CardFooter>
      </Card>
    </div>
  )
}
