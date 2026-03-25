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
import { Input } from "@/components/ui/input"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { PackageSearchIcon, XIcon } from "lucide-react"

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

export function SalesPage() {
    const [sales, setSales] = React.useState<Sale[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [products, setProducts] = React.useState<Product[]>([])
    const [isLoadingProducts, setIsLoadingProducts] = React.useState(true)
    const [productsLoadError, setProductsLoadError] = React.useState<string | null>(null)
    const [showNewSaleModal, setShowNewSaleModal] = React.useState(false)
    const [step, setStep] = React.useState<"product" | "details">("product")
    const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null)
    const [quantity, setQuantity] = React.useState("")
    const [sellingPrice, setSellingPrice] = React.useState("")
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
                setProductsLoadError("Loading products took too long. Please retry.")
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
        if (products.length === 0 && !isLoadingProducts) {
            void loadProducts()
        }
    }

    const resetSaleDraft = () => {
        setStep("product")
        setSelectedProduct(null)
        setQuantity("")
        setSellingPrice("")
        setProductSearch("")
    }

    const hasUnsavedSaleDraft = Boolean(selectedProduct) || Boolean(quantity) || Boolean(productSearch)

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

    const handleProductSelect = (product: Product) => {
        setSelectedProduct(product)
        setSellingPrice(toDecimalInput(String(product.landedCost)))
        setStep("details")
    }

    const handleSaveSale = async () => {
        if (!selectedProduct || !quantity || !sellingPrice) return

        setIsSaving(true)
        try {
            const response = await fetch("/api/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: selectedProduct._id,
                    quantity: Number(quantity),
                    sellingPrice: Number(stripCommas(sellingPrice)),
                }),
            })

            if (response.ok) {
                // Close modal and reset
                setShowNewSaleModal(false)
                resetSaleDraft()

                // Reload sales
                const salesResponse = await fetch("/api/sales")
                if (salesResponse.ok) {
                    const data = await salesResponse.json()
                    setSales(data.sales ?? [])
                }
            }
        } finally {
            setIsSaving(false)
        }
    }

    const filteredProducts = products.filter(
        (p) =>
            p.name.toLowerCase().includes(productSearch.toLowerCase())
    )

    const profit = selectedProduct
        ? Number(stripCommas(sellingPrice) || 0) - selectedProduct.landedCost
        : 0

    const selectedQuantity = Number(quantity || 0)
    const totalLandedCost = selectedProduct
        ? selectedProduct.landedCost * selectedQuantity
        : 0
    const availableQuantity = selectedProduct?.quantityRemaining ?? 0
    const isQuantityAboveAvailable = Boolean(selectedProduct) && selectedQuantity > availableQuantity
    const canSubmitSale = selectedQuantity > 0 && Boolean(sellingPrice) && !isSaving && !isQuantityAboveAvailable

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
                            )).toLocaleString()} RWF
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
            )}

            {showNewSaleModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
                    onClick={requestCloseSaleModal}
                >
                    <div
                        className="modal-pop-in bg-white dark:bg-slate-950 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                                    {step === "product" ? "Select Product" : "Record Sale"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={requestCloseSaleModal}
                                    className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
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

                                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                        {isLoadingProducts ? (
                                            <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-4">
                                                Loading products...
                                            </p>
                                        ) : productsLoadError ? (
                                            <div className="space-y-3 py-4 text-center">
                                                <p className="text-sm text-red-600 dark:text-red-400">
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
                                            <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-4">
                                                No products found
                                            </p>
                                        ) : (
                                            filteredProducts.map((product) => {
                                                const isOutOfStock = product.quantityRemaining === 0
                                                return (
                                                    <button
                                                        key={product._id}
                                                        onClick={() => handleProductSelect(product)}
                                                        disabled={isOutOfStock}
                                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${isOutOfStock
                                                            ? "cursor-not-allowed opacity-50 border-slate-200 dark:border-slate-800"
                                                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                                                            }`}
                                                    >
                                                        <p className="truncate font-medium text-slate-900 dark:text-slate-50">
                                                            {product.name}
                                                        </p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                                            In stock: {product.quantityRemaining} {product.unitOfMeasurement ?? ""}
                                                            {isOutOfStock && <span className="ml-2 font-medium text-red-600 dark:text-red-400">(Out of stock)</span>}
                                                        </p>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>

                                    <Button
                                        variant="outline"
                                        onClick={requestCloseSaleModal}
                                        className="w-full"
                                    >
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="mb-6">
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                                            {selectedProduct?.name}
                                        </h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            Available quantity: <span className="font-semibold text-slate-900 dark:text-slate-50">{availableQuantity}</span>
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-sm font-medium text-slate-900 dark:text-slate-50 block mb-2">
                                                Quantity
                                            </label>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Enter quantity"
                                                value={quantity}
                                                onChange={(e) => setQuantity(toIntegerInput(e.target.value))}
                                                min="1"
                                                max={selectedProduct?.quantityRemaining}
                                            />
                                            {isQuantityAboveAvailable ? (
                                                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                                                    Requested quantity is higher than available stock.
                                                </p>
                                            ) : null}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-900 dark:text-slate-50 block mb-2">
                                                Selling Price per Unit
                                            </label>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="Enter selling price"
                                                value={sellingPrice}
                                                onChange={(e) => setSellingPrice(toDecimalInput(e.target.value))}
                                                min="0"
                                            />
                                        </div>

                                        {sellingPrice && (
                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                {profit > 0 ? (
                                                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                        ✓ You&apos;re making a profit of {profit.toLocaleString()} RWF per unit
                                                    </p>
                                                ) : profit < 0 ? (
                                                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                                        ⚠ You&apos;re taking a loss of {Math.abs(profit).toLocaleString()} RWF per unit
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                        = Break even price
                                                    </p>
                                                )}
                                            </div>
                                        )}

                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Quantity selected: <span className="font-semibold text-slate-900 dark:text-slate-50">{selectedQuantity || 0}</span>
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Landed cost per unit: <span className="font-semibold text-slate-900 dark:text-slate-50">
                                                    {(selectedProduct?.landedCost ?? 0).toLocaleString()} RWF
                                                </span>
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Total landed cost: <span className="font-semibold text-slate-900 dark:text-slate-50">
                                                    {totalLandedCost.toLocaleString()} RWF
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setStep("product")
                                                setSelectedProduct(null)
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
            )}

            {showDiscardConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
                    <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                            Discard this sale draft?
                        </h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
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
            )}
        </div>
    )
}
