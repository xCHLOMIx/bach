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

type Sale = {
    _id: string
    quantity: number
    sellingPrice: number
    landedCost: number
    profit: number
    soldAt: string
    productId?: {
        _id?: string
        name?: string
    }
}

export function SalesPage() {
    const [sales, setSales] = React.useState<Sale[]>([])

    React.useEffect(() => {
        const load = async () => {
            const response = await fetch("/api/sales")
            if (!response.ok) return
            const data = await response.json()
            setSales(data.sales ?? [])
        }

        load()
    }, [])

    const totalProfit = sales.reduce(
        (sum, sale) => sum + sale.profit * sale.quantity,
        0
    )

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="px-0">
                <CardTitle className="text-2xl font-bold">Sales</CardTitle>
                <CardDescription>All recorded product sales.</CardDescription>
            </CardHeader>

            <section className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    Total profit: {totalProfit.toLocaleString()} RWF
                </p>
                <div className="overflow-hidden rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Qty</TableHead>
                                <TableHead>Selling Price</TableHead>
                                <TableHead>Landed Cost</TableHead>
                                <TableHead>Profit / Unit</TableHead>
                                <TableHead>Profit / Sale</TableHead>
                                <TableHead>Sold At</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sales.map((sale) => (
                                <TableRow key={sale._id}>
                                    <TableCell>{sale.productId?.name ?? "Unknown product"}</TableCell>
                                    <TableCell>{sale.quantity}</TableCell>
                                    <TableCell>{sale.sellingPrice.toLocaleString()}</TableCell>
                                    <TableCell>{sale.landedCost.toLocaleString()}</TableCell>
                                    <TableCell>{sale.profit.toLocaleString()}</TableCell>
                                    <TableCell>{(sale.profit * sale.quantity).toLocaleString()}</TableCell>
                                    <TableCell>{new Date(sale.soldAt).toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    )
}
