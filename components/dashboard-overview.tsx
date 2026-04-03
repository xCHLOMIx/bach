"use client"

import * as React from "react"

import {
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCards } from "@/components/section-cards"

type StatsResponse = {
    stats: {
        products: number
        categories: number
        batches: number
        sales: number
        totalProfit: number
        profitChangePercent: number
        profitTrend: "up" | "down" | "stable"
        totalStock: number
    }
    latestSales: Array<{
        _id: string
        quantity: number
        sellingPrice: number
        landedCost: number
        profit: number
        soldAt: string
        productId?: {
            name?: string
        }
    }>
}

export function DashboardOverview() {
    const [data, setData] = React.useState<StatsResponse | null>(null)

    React.useEffect(() => {
        const load = async () => {
            const response = await fetch("/api/dashboard/stats")
            if (!response.ok) return
            const json = (await response.json()) as StatsResponse
            setData(json)
        }

        load()
    }, [])

    return (
        <div className="flex flex-1 flex-col gap-4 py-4 lg:py-6">
            <SectionCards stats={data?.stats} />

            <div className="px-4 lg:px-6">
                <CardHeader className="px-0">
                    <CardTitle className="text-2xl font-bold">Recent Sales</CardTitle>
                    <CardDescription>Latest sales with profit per unit</CardDescription>
                </CardHeader>
                <div className="mt-4 overflow-x-auto rounded-xl border">
                    <div className="min-w-[680px]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Qty</TableHead>
                                    <TableHead>Selling Price</TableHead>
                                    <TableHead>Landed Cost</TableHead>
                                    <TableHead>Profit</TableHead>
                                    <TableHead>Sold At</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!data ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-8" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    (data?.latestSales ?? []).map((sale) => (
                                        <TableRow key={sale._id}>
                                            <TableCell>{sale.productId?.name ?? "Unknown product"}</TableCell>
                                            <TableCell>{sale.quantity}</TableCell>
                                            <TableCell>{sale.sellingPrice.toLocaleString()}</TableCell>
                                            <TableCell>{sale.landedCost.toLocaleString()}</TableCell>
                                            <TableCell>{sale.profit.toLocaleString()}</TableCell>
                                            <TableCell>{new Date(sale.soldAt).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    )
}
