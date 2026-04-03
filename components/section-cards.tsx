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
import { Skeleton } from "@/components/ui/skeleton"
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
  const isLoading = !stats
  const profitTrend = stats?.profitTrend ?? "stable"
  const profitChangePercent = stats?.profitChangePercent ?? 0
  const formattedProfitChange = `${Math.abs(profitChangePercent).toFixed(1)}%`

  const profitBadgeClass =
    profitTrend === "up"
      ? "text-primary border-primary/30 bg-primary/10"
      : profitTrend === "down"
        ? "text-destructive border-destructive/30 bg-destructive/10"
        : "text-muted-foreground border-border bg-muted"

  const ProfitTrendIcon =
    profitTrend === "up" ? TrendingUpIcon : profitTrend === "down" ? TrendingDownIcon : TrendingUpIcon

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="@container/card border-0 shadow-none">
            <CardHeader>
              <CardDescription>
                <Skeleton className="h-4 w-16" />
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl mt-2">
                <Skeleton className="h-8 w-12" />
              </CardTitle>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-24" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
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
              ? "text-primary"
              : profitTrend === "down"
                ? "text-destructive"
                : "text-muted-foreground"
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
