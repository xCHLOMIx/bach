"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { calculateBatchProductLandedCosts } from "@/lib/costs"
import { cn } from "@/lib/utils"

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

type Product = {
    _id: string
    name: string
    batchId?: { _id?: string } | null
    quantityInitial: number
    unitPriceLocalRWF?: number
    purchasePriceRWF: number
}

const initialBatchForm = {
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

const expenseFieldKeys = [
    "intlShipping",
    "taxValue",
    "customsDuties",
    "declaration",
    "arrivalNotif",
    "warehouseStorage",
    "amazonPrime",
    "warehouseUSA",
    "miscellaneous",
] as const

export function BatchDetailsPage({ batchId }: { batchId: string }) {
    const router = useRouter()

    const [isLoading, setIsLoading] = React.useState(true)
    const [loadError, setLoadError] = React.useState("")

    const [allBatches, setAllBatches] = React.useState<Batch[]>([])
    const [products, setProducts] = React.useState<Product[]>([])

    const [form, setForm] = React.useState(initialBatchForm)
    const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([])
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [isEditingTitle, setIsEditingTitle] = React.useState(false)
    const titleInputRef = React.useRef<HTMLInputElement | null>(null)

    const stripCommas = (value: string) => value.replace(/,/g, "")

    const formatDecimalWithCommas = (value: string) => {
        if (!value) {
            return ""
        }

        const [integerPart, decimalPart] = value.split(".")
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

        if (decimalPart !== undefined) {
            return `${formattedInteger}.${decimalPart}`
        }

        return formattedInteger
    }

    const toDecimalInput = (value: string) => {
        const digitsAndDotsOnly = stripCommas(value).replace(/[^\d.]/g, "")
        const firstDotIndex = digitsAndDotsOnly.indexOf(".")

        if (firstDotIndex === -1) {
            return formatDecimalWithCommas(digitsAndDotsOnly)
        }

        const beforeDot = digitsAndDotsOnly.slice(0, firstDotIndex + 1)
        const afterDot = digitsAndDotsOnly.slice(firstDotIndex + 1).replace(/\./g, "")

        return formatDecimalWithCommas(`${beforeDot}${afterDot}`)
    }

    const safeReadJson = async (response: Response) => {
        const text = await response.text()
        if (!text) {
            return null
        }

        try {
            return JSON.parse(text) as Record<string, unknown>
        } catch {
            return null
        }
    }

    const formatBatchForm = (batch: Batch) => ({
        batchName: batch.batchName,
        intlShipping: String(batch.intlShipping ?? 0),
        taxValue: String(batch.taxValue ?? 0),
        customsDuties: String(batch.customsDuties ?? 0),
        declaration: String(batch.declaration ?? 0),
        arrivalNotif: String(batch.arrivalNotif ?? 0),
        warehouseStorage: String(batch.warehouseStorage ?? 0),
        amazonPrime: String(batch.amazonPrime ?? 0),
        warehouseUSA: String(batch.warehouseUSA ?? 0),
        miscellaneous: String(batch.miscellaneous ?? 0),
    })

    const batchIdToName = React.useMemo(() => {
        return new Map(allBatches.map((batch) => [batch._id, batch.batchName]))
    }, [allBatches])

    const hasAnyExpenseAmount = React.useCallback(
        (nextForm: typeof initialBatchForm) => {
            return expenseFieldKeys.some((key) => Number(stripCommas(nextForm[key]) || 0) > 0)
        },
        []
    )

    const canSave = hasAnyExpenseAmount(form) && selectedProductIds.length > 0

    const parsedCosts = React.useMemo(() => {
        return {
            intlShipping: Number(stripCommas(form.intlShipping) || 0),
            taxValue: Number(stripCommas(form.taxValue) || 0),
            customsDuties: Number(stripCommas(form.customsDuties) || 0),
            declaration: Number(stripCommas(form.declaration) || 0),
            arrivalNotif: Number(stripCommas(form.arrivalNotif) || 0),
            warehouseStorage: Number(stripCommas(form.warehouseStorage) || 0),
            amazonPrime: Number(stripCommas(form.amazonPrime) || 0),
            warehouseUSA: Number(stripCommas(form.warehouseUSA) || 0),
            miscellaneous: Number(stripCommas(form.miscellaneous) || 0),
        }
    }, [form])

    const selectedProducts = React.useMemo(() => {
        const selectedIdSet = new Set(selectedProductIds)
        return products.filter((product) => selectedIdSet.has(product._id))
    }, [products, selectedProductIds])

    const allocationPreviewByProductId = React.useMemo(() => {
        const calculated = calculateBatchProductLandedCosts(
            selectedProducts.map((product) => ({
                productId: product._id,
                quantityInitial: product.quantityInitial,
                unitPriceLocalRWF: product.unitPriceLocalRWF ?? product.purchasePriceRWF,
            })),
            parsedCosts
        )

        const previewMap = new Map<string, { weightPercentage: number; landedCost: number }>()
        const totalSelectedPurchaseValue = selectedProducts.reduce((sum, product) => {
            const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
            return sum + baseUnitPrice * product.quantityInitial
        }, 0)

        for (const item of calculated) {
            const purchaseValue = item.purchasePriceRWF * item.quantityInitial
            const weightPercentage = totalSelectedPurchaseValue > 0
                ? (purchaseValue / totalSelectedPurchaseValue) * 100
                : 0

            previewMap.set(item.productId, {
                weightPercentage,
                landedCost: item.landedCost,
            })
        }

        return previewMap
    }, [selectedProducts, parsedCosts])

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            setLoadError("")

            try {
                const [batchesRes, productsRes] = await Promise.all([
                    fetch("/api/batches"),
                    fetch("/api/products"),
                ])

                if (!batchesRes.ok) {
                    setLoadError("Failed to load batch")
                    return
                }

                const batchesData = await batchesRes.json()
                const batches = (batchesData.batches ?? []) as Batch[]
                setAllBatches(batches)

                const currentBatch = batches.find((batch) => batch._id === batchId)
                if (!currentBatch) {
                    setLoadError("Batch not found")
                    return
                }

                setForm(formatBatchForm(currentBatch))
                setSelectedProductIds((currentBatch.products ?? []).map((product) => product._id))

                if (productsRes.ok) {
                    const productsData = await productsRes.json()
                    setProducts(productsData.products ?? [])
                }
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [batchId])

    React.useEffect(() => {
        if (isEditingTitle) {
            titleInputRef.current?.focus()
            titleInputRef.current?.select()
        }
    }, [isEditingTitle])

    const renderFieldError = (field: string) => {
        if (!errors[field]) {
            return null
        }

        return <p className="text-xs text-destructive">{errors[field]}</p>
    }

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        try {
            if (!hasAnyExpenseAmount(form)) {
                setErrors({ general: "Add at least one expense amount" })
                return
            }

            if (selectedProductIds.length === 0) {
                setErrors({ general: "Select at least one product" })
                return
            }

            const payload = Object.fromEntries(
                Object.entries(form).map(([key, value]) => {
                    if (key === "batchName") return [key, value]
                    return [key, Number(stripCommas(value) || 0)]
                })
            )

            const updateResponse = await fetch(`/api/batches/${batchId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const updateData = await safeReadJson(updateResponse)
            if (!updateResponse.ok) {
                const updateErrors = (updateData?.errors ?? null) as Record<string, string> | null
                setErrors(updateErrors ?? { general: "Failed to update batch" })
                return
            }

            const syncResponse = await fetch(`/api/batches/${batchId}/products`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productIds: selectedProductIds }),
            })

            const syncData = await safeReadJson(syncResponse)
            if (!syncResponse.ok) {
                const syncErrors = (syncData?.errors ?? null) as Record<string, string> | null
                setErrors(syncErrors ?? { general: "Failed to update products" })
                return
            }

            router.push("/app/batches")
            router.refresh()
            return
        } finally {
            setIsSubmitting(false)
        }
    }

    const renderProductSelector = () => {
        if (products.length === 0) {
            return (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No products available yet.
                </div>
            )
        }

        return (
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-16">Pick</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead>Assigned</TableHead>
                            <TableHead className="text-right">Base Unit (RWF)</TableHead>
                            <TableHead className="text-right">Weight %</TableHead>
                            <TableHead className="text-right">After Distribution (RWF)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.map((product) => {
                            const isSelected = selectedProductIds.includes(product._id)
                            const assignedBatchId = product.batchId?._id
                            const assignedBatchName = assignedBatchId ? batchIdToName.get(assignedBatchId) : null
                            const preview = allocationPreviewByProductId.get(product._id)
                            const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF

                            return (
                                <TableRow
                                    key={product._id}
                                    className={cn("cursor-pointer", isSelected ? "bg-border/60" : "hover:bg-muted/40")}
                                    onClick={() => {
                                        setSelectedProductIds((current) =>
                                            current.includes(product._id)
                                                ? current.filter((id) => id !== product._id)
                                                : [...current, product._id]
                                        )
                                    }}
                                >
                                    <TableCell onClick={(event) => event.stopPropagation()}>
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => {
                                                setSelectedProductIds((current) =>
                                                    current.includes(product._id)
                                                        ? current.filter((id) => id !== product._id)
                                                        : [...current, product._id]
                                                )
                                            }}
                                            aria-label={`Select ${product.name}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{assignedBatchName ?? "Unassigned"}</TableCell>
                                    <TableCell className="text-right">{baseUnitPrice.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">
                                        {isSelected
                                            ? `${(preview?.weightPercentage ?? 0).toFixed(2)}%`
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {isSelected
                                            ? (preview?.landedCost ?? baseUnitPrice).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                            : "-"}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        )
    }

    if (isLoading) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                <p className="text-sm text-muted-foreground">Loading batch...</p>
            </div>
        )
    }

    if (loadError) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                <p className="text-sm text-destructive">{loadError}</p>
            </div>
        )
    }

    return (
        <form className="flex flex-1 flex-col gap-4 p-4 lg:p-6" onSubmit={submit}>
            <CardHeader className="flex items-center justify-between gap-3 px-0">
                <div>
                    {isEditingTitle ? (
                        <Input
                            ref={titleInputRef}
                            value={form.batchName}
                            onBlur={() => setIsEditingTitle(false)}
                            onChange={(event) => setForm((current) => ({ ...current, batchName: event.target.value }))}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === "Escape") {
                                    event.preventDefault()
                                    setIsEditingTitle(false)
                                }
                            }}
                            className="min-w-60 text-2xl font-bold p-0 h-max rounded-none ring-0 border-0 border-b p-3 focus:ring-0 focus-visible:ring-0"
                        />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setIsEditingTitle(true)}
                            className="text-left"
                        >
                            <CardTitle className="text-2xl font-bold">{form.batchName || "Batch"}</CardTitle>
                        </button>
                    )}
                </div>
                <Button
                    type="submit"
                    size={"lg"}
                    className="h-10 px-6 disabled:opacity-50"
                    disabled={isSubmitting || !canSave}
                >
                    {isSubmitting ? "Saving..." : "Save"}
                </Button>
            </CardHeader>

            {!canSave ? (
                <p className="text-xs text-muted-foreground">
                    Add at least one expense amount and select at least one product.
                </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                    <label htmlFor="intl-shipping" className="text-sm font-medium">Intl shipping</label>
                    <Input
                        id="intl-shipping"
                        type="text"
                        inputMode="decimal"
                        value={form.intlShipping}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, intlShipping: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("intlShipping")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="tax-value" className="text-sm font-medium">Tax value</label>
                    <Input
                        id="tax-value"
                        type="text"
                        inputMode="decimal"
                        value={form.taxValue}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, taxValue: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("taxValue")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="customs-duties" className="text-sm font-medium">Customs duties</label>
                    <Input
                        id="customs-duties"
                        type="text"
                        inputMode="decimal"
                        value={form.customsDuties}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, customsDuties: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("customsDuties")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="declaration" className="text-sm font-medium">Declaration</label>
                    <Input
                        id="declaration"
                        type="text"
                        inputMode="decimal"
                        value={form.declaration}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, declaration: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("declaration")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="arrival-notif" className="text-sm font-medium">Arrival notification</label>
                    <Input
                        id="arrival-notif"
                        type="text"
                        inputMode="decimal"
                        value={form.arrivalNotif}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, arrivalNotif: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("arrivalNotif")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="warehouse-storage" className="text-sm font-medium">Warehouse storage</label>
                    <Input
                        id="warehouse-storage"
                        type="text"
                        inputMode="decimal"
                        value={form.warehouseStorage}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, warehouseStorage: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("warehouseStorage")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="amazon-prime" className="text-sm font-medium">Amazon Prime</label>
                    <Input
                        id="amazon-prime"
                        type="text"
                        inputMode="decimal"
                        value={form.amazonPrime}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, amazonPrime: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("amazonPrime")}
                </div>
                <div className="grid gap-1.5">
                    <label htmlFor="warehouse-usa" className="text-sm font-medium">Warehouse USA</label>
                    <Input
                        id="warehouse-usa"
                        type="text"
                        inputMode="decimal"
                        value={form.warehouseUSA}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, warehouseUSA: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("warehouseUSA")}
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                    <label htmlFor="miscellaneous" className="text-sm font-medium">Miscellaneous</label>
                    <Input
                        id="miscellaneous"
                        type="text"
                        inputMode="decimal"
                        value={form.miscellaneous}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, miscellaneous: toDecimalInput(event.target.value) }))
                        }
                    />
                    {renderFieldError("miscellaneous")}
                </div>
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium">Products</p>
                {renderProductSelector()}
            </div>

            {errors.general ? <p className="text-sm text-destructive">{errors.general}</p> : null}
        </form>
    )
}
