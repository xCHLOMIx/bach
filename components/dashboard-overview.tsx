"use client"

import * as React from "react"

import {
    Card,
    CardContent,
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
import { SectionCards } from "@/components/section-cards"

type StatsResponse = {
    stats: {
        products: number
        categories: number
        batches: number
        sales: number
        totalProfit: number
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
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Sales</CardTitle>
                        <CardDescription>Latest sales with profit per unit</CardDescription>
                    </CardHeader>
                    <CardContent>
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
                                {(data?.latestSales ?? []).map((sale) => (
                                    <TableRow key={sale._id}>
                                        <TableCell>{sale.productId?.name ?? "Unknown product"}</TableCell>
                                        <TableCell>{sale.quantity}</TableCell>
                                        <TableCell>{sale.sellingPrice.toLocaleString()}</TableCell>
                                        <TableCell>{sale.landedCost.toLocaleString()}</TableCell>
                                        <TableCell>{sale.profit.toLocaleString()}</TableCell>
                                        <TableCell>{new Date(sale.soldAt).toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
