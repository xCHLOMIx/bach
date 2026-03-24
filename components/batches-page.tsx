"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

type Batch = {
    _id: string
    batchName: string
    intlShipping: number
    taxValue: number
    customsDuties: number
    declaration: number
    arrivalNotif: number
    warehouseStorage: number
    amazonPrime: number
    warehouseUSA: number
    miscellaneous: number
    createdAt: string
    productCount?: number
    products?: Array<{
        _id: string
        name: string
        quantityRemaining: number
    }>
}

type Product = { _id: string; name: string; batchId?: { _id?: string } | null }

const initialCostForm = {
    batchName: "",
    intlShipping: "0",
    taxValue: "0",
    customsDuties: "0",
    declaration: "0",
    arrivalNotif: "0",
    warehouseStorage: "0",
    amazonPrime: "0",
    warehouseUSA: "0",
    miscellaneous: "0",
}

export function BatchesPage() {
    const [batches, setBatches] = React.useState<Batch[]>([])
    const [products, setProducts] = React.useState<Product[]>([])
    const [costForm, setCostForm] = React.useState(initialCostForm)
    const [errors, setErrors] = React.useState<Record<string, string>>({})

    const [selectedBatchId, setSelectedBatchId] = React.useState("")
    const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([])
    const [itemErrors, setItemErrors] = React.useState<Record<string, string>>({})

    const load = React.useCallback(async () => {
        const [batchesRes, productsRes] = await Promise.all([
            fetch("/api/batches"),
            fetch("/api/products"),
        ])

        if (batchesRes.ok) {
            const data = await batchesRes.json()
            setBatches(data.batches ?? [])
        }

        if (productsRes.ok) {
            const data = await productsRes.json()
            setProducts(data.products ?? [])
        }
    }, [])

    React.useEffect(() => {
        load()
    }, [load])

    const onCreateBatch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setErrors({})

        const payload = Object.fromEntries(
            Object.entries(costForm).map(([key, value]) => {
                if (key === "batchName") return [key, value]
                return [key, Number(value)]
            })
        )

        const response = await fetch("/api/batches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })

        const data = await response.json()
        if (!response.ok) {
            setErrors(data.errors ?? { general: "Failed to create batch" })
            return
        }

        setCostForm(initialCostForm)
        await load()
    }

    const submitBatchProducts = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setItemErrors({})

        if (!selectedBatchId) {
            setItemErrors({ batchId: "Batch is required" })
            return
        }

        if (selectedProductIds.length === 0) {
            setItemErrors({ productIds: "Select at least one product" })
            return
        }

        const response = await fetch(`/api/batches/${selectedBatchId}/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: selectedProductIds }),
        })

        const data = await response.json()
        if (!response.ok) {
            setItemErrors(data.errors ?? { general: "Failed to add products" })
            return
        }

        setSelectedProductIds([])
        setSelectedBatchId("")
        await load()
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <Card>
                <CardHeader>
                    <CardTitle>Create Batch</CardTitle>
                    <CardDescription>Enter shipment and cost details.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={onCreateBatch}>
                        <Input
                            placeholder="Batch name"
                            value={costForm.batchName}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, batchName: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Intl shipping"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.intlShipping}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, intlShipping: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Tax value"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.taxValue}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, taxValue: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Customs duties"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.customsDuties}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, customsDuties: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Declaration"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.declaration}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, declaration: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Arrival notif"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.arrivalNotif}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, arrivalNotif: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Warehouse storage"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.warehouseStorage}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, warehouseStorage: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Amazon Prime"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.amazonPrime}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, amazonPrime: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Warehouse USA"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.warehouseUSA}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, warehouseUSA: event.target.value }))
                            }
                        />
                        <Input
                            placeholder="Miscellaneous"
                            type="number"
                            min={0}
                            step="0.01"
                            value={costForm.miscellaneous}
                            onChange={(event) =>
                                setCostForm((current) => ({ ...current, miscellaneous: event.target.value }))
                            }
                        />
                        <Button type="submit">Create Batch</Button>
                    </form>
                    {errors.general ? <p className="mt-2 text-sm text-destructive">{errors.general}</p> : null}
                    {errors.batchName ? <p className="mt-2 text-sm text-destructive">{errors.batchName}</p> : null}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Add Products To Batch</CardTitle>
                    <CardDescription>Assign existing products directly to a batch.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="grid gap-3" onSubmit={submitBatchProducts}>
                        <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Select batch" />
                            </SelectTrigger>
                            <SelectContent>
                                {batches.map((batch) => (
                                    <SelectItem key={batch._id} value={batch._id}>
                                        {batch.batchName}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {itemErrors.batchId ? (
                            <p className="text-sm text-destructive">{itemErrors.batchId}</p>
                        ) : null}

                        <div className="grid gap-2 md:grid-cols-2">
                            {products.map((product) => {
                                const checked = selectedProductIds.includes(product._id)
                                const isAssignedElsewhere = !!product.batchId?._id && product.batchId._id !== selectedBatchId

                                return (
                                    <Button
                                        key={product._id}
                                        type="button"
                                        variant={checked ? "default" : "outline"}
                                        disabled={isAssignedElsewhere}
                                        onClick={() => {
                                            setSelectedProductIds((current) =>
                                                current.includes(product._id)
                                                    ? current.filter((id) => id !== product._id)
                                                    : [...current, product._id]
                                            )
                                        }}
                                        className="justify-start"
                                    >
                                        {product.name}
                                    </Button>
                                )
                            })}
                        </div>
                        {itemErrors.productIds ? (
                            <p className="text-sm text-destructive">{itemErrors.productIds}</p>
                        ) : null}

                        <div className="flex gap-2">
                            <Button type="submit">Assign Selected Products</Button>
                        </div>

                        {itemErrors.general ? (
                            <p className="text-sm text-destructive">{itemErrors.general}</p>
                        ) : null}
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Batches</CardTitle>
                    <CardDescription>All imported shipments.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Intl Shipping</TableHead>
                                <TableHead>Products</TableHead>
                                <TableHead>Product Names</TableHead>
                                <TableHead>Created</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {batches.map((batch) => (
                                <TableRow key={batch._id}>
                                    <TableCell>{batch.batchName}</TableCell>
                                    <TableCell>{batch.intlShipping.toLocaleString()}</TableCell>
                                    <TableCell>{batch.productCount ?? 0}</TableCell>
                                    <TableCell>
                                        {batch.products?.length
                                            ? batch.products.map((product) => product.name).join(", ")
                                            : "-"}
                                    </TableCell>
                                    <TableCell>{new Date(batch.createdAt).toLocaleDateString()}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
