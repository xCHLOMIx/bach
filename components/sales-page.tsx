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
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { PackageSearchIcon, XIcon } from "lucide-react"
import { formatRWF } from "@/lib/utils"

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

type Product = {
    _id: string
    name: string
    quantityRemaining: number
    landedCost: number
    unitOfMeasurement?: string
}

type BulkSaleRow = {
    productId: string
    name: string
    availableQuantity: number
    landedCost: number
    quantity: string
    sellingPrice: string
}

type BulkSaleRowErrors = Record<string, { quantity?: string; sellingPrice?: string }>

export function SalesPage() {
    const [sales, setSales] = React.useState<Sale[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [products, setProducts] = React.useState<Product[]>([])
    const [isLoadingProducts, setIsLoadingProducts] = React.useState(true)
    const [productsLoadError, setProductsLoadError] = React.useState<string | null>(null)
    const [showNewSaleModal, setShowNewSaleModal] = React.useState(false)
    const [step, setStep] = React.useState<"product" | "details">("product")
    const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set())
    const [bulkSaleRows, setBulkSaleRows] = React.useState<BulkSaleRow[]>([])
    const [bulkSaleRowErrors, setBulkSaleRowErrors] = React.useState<BulkSaleRowErrors>({})
    const [bulkSaleGeneralError, setBulkSaleGeneralError] = React.useState("")
    const [productSearch, setProductSearch] = React.useState("")
    const [isSaving, setIsSaving] = React.useState(false)
    const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false)

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

    const toIntegerInput = (value: string) => value.replace(/\D/g, "")

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            try {
                const response = await fetch("/api/sales")
                if (!response.ok) return
                const data = await response.json()
                setSales(data.sales ?? [])
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [])

    const loadProducts = React.useCallback(async () => {
        setIsLoadingProducts(true)
        setProductsLoadError(null)

        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => {
            controller.abort()
        }, 10000)

        try {
            const response = await fetch("/api/products", {
                signal: controller.signal,
                cache: "no-store",
            })

            if (!response.ok) {
                setProducts([])
                setProductsLoadError("Could not load products right now.")
                return
            }

            const data = await response.json()
            setProducts(Array.isArray(data.products) ? data.products : [])
        } catch (error) {
            setProducts([])
            if ((error as Error).name === "AbortError") {
                setProductsLoadError("Product fetch took too long. Please retry.")
            } else {
                setProductsLoadError("Could not load products right now.")
            }
        } finally {
            window.clearTimeout(timeoutId)
            setIsLoadingProducts(false)
        }
    }, [])

    React.useEffect(() => {
        void loadProducts()
    }, [loadProducts])

    const openNewSaleModal = () => {
        setShowNewSaleModal(true)
        setStep("product")
        setSelectedProductIds(new Set())
        setBulkSaleRows([])
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
        if (products.length === 0 && !isLoadingProducts) {
            void loadProducts()
        }
    }

    const resetSaleDraft = () => {
        setStep("product")
        setSelectedProductIds(new Set())
        setBulkSaleRows([])
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
        setProductSearch("")
    }

    const hasUnsavedSaleDraft =
        selectedProductIds.size > 0 ||
        bulkSaleRows.some((row) => Boolean(row.quantity) || Boolean(row.sellingPrice)) ||
        Boolean(productSearch)

    const requestCloseSaleModal = () => {
        if (isSaving) {
            return
        }

        if (hasUnsavedSaleDraft) {
            setShowDiscardConfirm(true)
            return
        }

        setShowNewSaleModal(false)
        resetSaleDraft()
    }

    const discardSaleDraftAndClose = () => {
        setShowDiscardConfirm(false)
        setShowNewSaleModal(false)
        resetSaleDraft()
    }

    const toggleProductSelection = (productId: string) => {
        setSelectedProductIds((current) => {
            const next = new Set(current)
            if (next.has(productId)) {
                next.delete(productId)
            } else {
                next.add(productId)
            }
            return next
        })
    }

    const openBulkSaleDetails = () => {
        const selected = products.filter((product) => selectedProductIds.has(product._id) && product.quantityRemaining > 0)

        const rows = selected.map((product) => ({
            productId: product._id,
            name: product.name,
            availableQuantity: product.quantityRemaining,
            landedCost: product.landedCost,
            quantity: "",
            sellingPrice: formatDecimalWithCommas(String(product.landedCost)),
        }))

        setBulkSaleRows(rows)
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
        setStep("details")
    }

    const handleSaveSale = async () => {
        setIsSaving(true)
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")

        const nextErrors: BulkSaleRowErrors = {}

        for (const row of bulkSaleRows) {
            const parsedQuantity = Number(row.quantity || 0)
            const parsedSellingPrice = Number(stripCommas(row.sellingPrice) || 0)

            if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
                nextErrors[row.productId] = {
                    ...(nextErrors[row.productId] ?? {}),
                    quantity: "Quantity must be greater than 0",
                }
            } else if (parsedQuantity > row.availableQuantity) {
                nextErrors[row.productId] = {
                    ...(nextErrors[row.productId] ?? {}),
                    quantity: "Requested quantity is higher than available stock",
                }
            }

            if (!Number.isFinite(parsedSellingPrice) || parsedSellingPrice < 0) {
                nextErrors[row.productId] = {
                    ...(nextErrors[row.productId] ?? {}),
                    sellingPrice: "Selling price must be 0 or higher",
                }
            }
        }

        if (Object.keys(nextErrors).length > 0) {
            setBulkSaleRowErrors(nextErrors)
            setIsSaving(false)
            return
        }

        try {
            const failedProducts: string[] = []

            // Use Promise.all for parallel requests instead of sequential loop
            const responses = await Promise.all(
                bulkSaleRows.map((row) =>
                    fetch("/api/sales", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            productId: row.productId,
                            quantity: Number(row.quantity),
                            sellingPrice: Number(stripCommas(row.sellingPrice)),
                        }),
                    })
                )
            )

            // Check responses for failures
            responses.forEach((response, index) => {
                if (!response.ok) {
                    failedProducts.push(bulkSaleRows[index].name)
                }
            })

            if (failedProducts.length > 0) {
                setBulkSaleGeneralError(`Failed to record sale for: ${failedProducts.join(", ")}`)
                return
            }

            setShowNewSaleModal(false)
            resetSaleDraft()

            const salesResponse = await fetch("/api/sales")
            if (salesResponse.ok) {
                const data = await salesResponse.json()
                setSales(data.sales ?? [])
            }

            void loadProducts()
        } finally {
            setIsSaving(false)
        }
    }

    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(productSearch.toLowerCase())
    )

    const selectedCount = selectedProductIds.size
    const selectedInStockCount = products.filter((product) => selectedProductIds.has(product._id) && product.quantityRemaining > 0).length
    const canProceedToDetails = selectedInStockCount > 0
    const canSubmitSale = bulkSaleRows.length > 0 && !isSaving

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <div className="flex items-center justify-between">
                <CardHeader className="px-0 flex-1">
                    <CardTitle className="text-2xl font-bold">Sales</CardTitle>
                    <CardDescription>All recorded product sales.</CardDescription>
                </CardHeader>
                <Button onClick={openNewSaleModal} size={"lg"} className="px-6 h-10">
                    Record Sale
                </Button>
            </div>

            {!isLoading && sales.length === 0 ? (
                <Empty className="border-dashed">
                    <EmptyHeader>
                        <div className="bg-border/40 mb-4 rounded-lg p-3">
                            <PackageSearchIcon className="size-10" />
                        </div>
                        <EmptyTitle>No sales recorded</EmptyTitle>
                        <EmptyDescription>
                            Start recording your first product sale
                        </EmptyDescription>
                    </EmptyHeader>
                    <Button onClick={openNewSaleModal} size="sm">
                        Record Sale
                    </Button>
                </Empty>
            ) : (
                <section className="space-y-4">
                    {isLoading ? (
                        <Skeleton className="h-4 w-56" />
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Total profit: {(sales.reduce(
                                (sum, sale) => sum + sale.profit * sale.quantity,
                                0
                            ))} RWF
                        </p>
                    )}
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
                                {isLoading
                                    ? Array.from({ length: 6 }).map((_, index) => (
                                        <TableRow key={`sales-loading-${index}`}>
                                            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                                        </TableRow>
                                    ))
                                    : sales.map((sale) => (
                                        <TableRow key={sale._id}>
                                            <TableCell>{sale.productId?.name ?? "Unknown product"}</TableCell>
                                            <TableCell>{sale.quantity}</TableCell>
                                            <TableCell>{formatRWF(sale.sellingPrice)}</TableCell>
                                            <TableCell>{formatRWF(sale.landedCost)}</TableCell>
                                            <TableCell>{formatRWF(sale.profit)}</TableCell>
                                            <TableCell>{formatRWF(sale.profit * sale.quantity)}</TableCell>
                                            <TableCell>{new Date(sale.soldAt).toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                </section>
            )}

            {showNewSaleModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
                    onClick={requestCloseSaleModal}
                >
                    <div
                        className="modal-pop-in bg-card rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-border"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {step === "product" ? "Select Product" : "Record Sale"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={requestCloseSaleModal}
                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="Close sale modal"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                            {step === "product" ? (
                                <>
                                    <div className="">
                                        <Input
                                            placeholder="Search products..."
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            className="mb-4"
                                        />
                                    </div>

                                    <div className="mb-3 flex items-center justify-between text-sm">
                                        <p className="text-muted-foreground">
                                            Selected: <span className="font-semibold text-foreground">{selectedCount}</span>
                                        </p>
                                        <p className="text-muted-foreground">
                                            In stock: <span className="font-semibold text-foreground">{selectedInStockCount}</span>
                                        </p>
                                    </div>

                                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                        {isLoadingProducts ? (
                                            <div className="space-y-2 py-2">
                                                {[0, 1, 2, 3].map((index) => (
                                                    <div key={`sales-product-loading-${index}`} className="rounded-md border p-3">
                                                        <Skeleton className="h-4 w-36" />
                                                        <Skeleton className="mt-2 h-3 w-20" />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : productsLoadError ? (
                                            <div className="space-y-3 py-4 text-center">
                                                <p className="text-sm text-destructive">
                                                    {productsLoadError}
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        void loadProducts()
                                                    }}
                                                >
                                                    Retry
                                                </Button>
                                            </div>
                                        ) : filteredProducts.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No products found
                                            </p>
                                        ) : (
                                            filteredProducts.map((product) => {
                                                const isOutOfStock = product.quantityRemaining === 0
                                                const isSelected = selectedProductIds.has(product._id)
                                                return (
                                                    <button
                                                        key={product._id}
                                                        type="button"
                                                        onClick={() => toggleProductSelection(product._id)}
                                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${isOutOfStock
                                                            ? "border-border opacity-70"
                                                            : isSelected
                                                                ? "border-primary/30 bg-primary/10"
                                                                : "border-border hover:bg-muted"
                                                            }`}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleProductSelection(product._id)}
                                                                onClick={(event) => event.stopPropagation()}
                                                                aria-label={`Select ${product.name}`}
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="truncate font-medium text-foreground">
                                                                    {product.name}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    In stock: {product.quantityRemaining} {product.unitOfMeasurement ?? ""}
                                                                    {isOutOfStock ? <span className="ml-2 font-medium text-destructive">(Out of stock)</span> : null}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={requestCloseSaleModal}
                                            className="flex-1"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={openBulkSaleDetails}
                                            className="flex-1"
                                            disabled={!canProceedToDetails}
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-foreground">Record Bulk Sale</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Enter quantity and selling price for each selected product.
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-6 max-h-[55vh] overflow-y-auto pr-1">
                                        {bulkSaleRows.map((row) => {
                                            const quantityValue = Number(row.quantity || 0)
                                            const sellingPriceValue = Number(stripCommas(row.sellingPrice) || 0)
                                            const totalLandedCost = row.landedCost * quantityValue
                                            const totalSellingValue = sellingPriceValue * quantityValue
                                            const totalProfit = totalSellingValue - totalLandedCost

                                            return (
                                                <div key={row.productId} className="rounded-lg border border-border p-3">
                                                    <div className="mb-3">
                                                        <h3 className="font-medium text-foreground truncate">{row.name}</h3>
                                                        <p className="text-xs text-muted-foreground">Available quantity: {row.availableQuantity}</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <label className="text-sm font-medium text-foreground block mb-2">Quantity</label>
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                placeholder="Enter quantity"
                                                                value={row.quantity}
                                                                onChange={(event) => {
                                                                    const nextQuantity = toIntegerInput(event.target.value)
                                                                    setBulkSaleRows((current) =>
                                                                        current.map((currentRow) =>
                                                                            currentRow.productId === row.productId
                                                                                ? { ...currentRow, quantity: nextQuantity }
                                                                                : currentRow
                                                                        )
                                                                    )
                                                                }}
                                                            />
                                                            {bulkSaleRowErrors[row.productId]?.quantity ? (
                                                                <p className="mt-2 text-xs font-medium text-destructive">
                                                                    {bulkSaleRowErrors[row.productId]?.quantity}
                                                                </p>
                                                            ) : null}
                                                        </div>

                                                        <div>
                                                            <label className="text-sm font-medium text-foreground block mb-2">Selling Price / Unit</label>
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                placeholder="Enter selling price"
                                                                value={row.sellingPrice}
                                                                onChange={(event) => {
                                                                    const nextSellingPrice = toDecimalInput(event.target.value)
                                                                    setBulkSaleRows((current) =>
                                                                        current.map((currentRow) =>
                                                                            currentRow.productId === row.productId
                                                                                ? { ...currentRow, sellingPrice: nextSellingPrice }
                                                                                : currentRow
                                                                        )
                                                                    )
                                                                }}
                                                            />
                                                            {bulkSaleRowErrors[row.productId]?.sellingPrice ? (
                                                                <p className="mt-2 text-xs font-medium text-destructive">
                                                                    {bulkSaleRowErrors[row.productId]?.sellingPrice}
                                                                </p>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                                        <p>Total landed cost: <span className="font-semibold text-foreground">{formatRWF(totalLandedCost)} RWF</span></p>
                                                        <p>Total value: <span className="font-semibold text-foreground">{formatRWF(totalSellingValue)} RWF</span></p>
                                                        <p>
                                                            {totalProfit >= 0 ? "Profit" : "Loss"}: <span className={totalProfit >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>{formatRWF(Math.abs(totalProfit))} RWF</span></p>
                                                    </p>
                                                </div>
                                                </div>
                                    )
                                        })}

                                    {bulkSaleGeneralError ? (
                                        <p className="text-xs font-medium text-destructive">{bulkSaleGeneralError}</p>
                                    ) : null}
                                </div>

                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setStep("product")
                                    }}
                                >
                                    Back
                                </Button>
                                <Button
                                    onClick={handleSaveSale}
                                    disabled={!canSubmitSale}
                                    className="flex-1 disabled:opacity-40"
                                >
                                    {isSaving ? "Saving..." : "Record Sale"}
                                </Button>
                            </div>
                        </>
                            )}
                    </div>
                </div>
                </div>
    )
}

{
    showDiscardConfirm && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
            <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                <h3 className="text-base font-semibold text-foreground">
                    Discard this sale draft?
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                    You have unsaved changes. Do you want to discard them and close?
                </p>
                <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowDiscardConfirm(false)}>
                        Continue editing
                    </Button>
                    <Button variant="destructive" onClick={discardSaleDraftAndClose}>
                        Discard and close
                    </Button>
                </div>
            </div>
        </div>
    )
}
        </div >
    )
}
