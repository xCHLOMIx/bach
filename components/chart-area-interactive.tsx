"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { useIsMobile } from "@/hooks/use-mobile"
import { formatRWF } from "@/lib/utils"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"

export const description = "An interactive area chart"

type SalesApiItem = {
  soldAt: string
  quantity: number
  sellingPrice: number
  productId?: {
    name?: string
  }
}

type SalesChartPoint = {
  date: string
  sales: number
  productsSummary: string
}

function formatDateKeyLocal(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function truncateName(name: string, maxLength = 16) {
  if (name.length <= maxLength) return name
  return `${name.slice(0, maxLength - 3)}...`
}

function summarizeProducts(names: string[]) {
  if (names.length === 0) return "No products sold"
  const displayNames = names.slice(0, 3).map((name) => truncateName(name))
  const hasMore = names.length > 3
  return `${displayNames.join(", ")}${hasMore ? ", ..." : ""}`
}

const chartConfig = {
  sales: {
    label: "Sales",
    color: "var(--primary)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")
  const [salesByDate, setSalesByDate] = React.useState<Record<string, { sales: number; products: string[] }>>({})

  React.useEffect(() => {
    let active = true

    const loadSalesData = async () => {
      // Determine days to fetch based on timeRange
      let daysToFetch = 90
      if (timeRange === "30d") {
        daysToFetch = 30
      } else if (timeRange === "7d") {
        daysToFetch = 7
      }

      // Pass date range to API to reduce payload on server
      const response = await fetch(`/api/sales?days=${daysToFetch}`)
      if (!response.ok || !active) return

      const json = await response.json()
      const sales = (json.sales ?? []) as SalesApiItem[]

      const grouped = new Map<string, { sales: number; products: Set<string> }>()
      for (const sale of sales) {
        const date = formatDateKeyLocal(new Date(sale.soldAt))
        const current = grouped.get(date) ?? { sales: 0, products: new Set<string>() }
        current.sales += sale.sellingPrice * sale.quantity

        const productName = sale.productId?.name?.trim()
        if (productName) {
          current.products.add(productName)
        }

        grouped.set(date, current)
      }

      const normalized: Record<string, { sales: number; products: string[] }> = {}
      for (const [date, value] of grouped.entries()) {
        normalized[date] = {
          sales: value.sales,
          products: Array.from(value.products),
        }
      }

      if (!active) return
      setSalesByDate(normalized)
    }

    loadSalesData()

    return () => {
      active = false
    }
  }, [timeRange])

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = React.useMemo<SalesChartPoint[]>(() => {
    let daysToShow = 90
    if (timeRange === "30d") {
      daysToShow = 30
    } else if (timeRange === "7d") {
      daysToShow = 7
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const points: SalesChartPoint[] = []
    for (let i = daysToShow - 1; i >= 0; i -= 1) {
      const date = new Date(today)
      date.setDate(today.getDate() - i)
      const key = formatDateKeyLocal(date)
      const dayAggregate = salesByDate[key]

      points.push({
        date: key,
        sales: dayAggregate?.sales ?? 0,
        productsSummary: summarizeProducts(dayAggregate?.products ?? []),
      })
    }

    return points
  }, [salesByDate, timeRange])

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Sales Trend</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total sales value for the selected period
          </span>
          <span className="@[540px]/card:hidden">Sales by date</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSales" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-sales)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-sales)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={80}
              tickFormatter={(value) => formatRWF(Number(value))}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                  formatter={(value, _name, item) => {
                    const payload = item.payload as SalesChartPoint
                    return (
                      <div className="grid gap-1">
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {formatRWF(Number(value))} RWF
                        </span>
                        <span className="max-w-56 truncate text-[11px] text-muted-foreground">
                          Products: {payload.productsSummary}
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <Area
              dataKey="sales"
              type="natural"
              fill="url(#fillSales)"
              stroke="var(--color-sales)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
