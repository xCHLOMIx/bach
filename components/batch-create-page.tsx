"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { AddProductSheet } from "@/components/add-product-sheet"
import { calculateBatchProductLandedCosts, convertInternationalExpenseToRwf } from "@/lib/costs"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"
import { getAllIntendedSellingPrices } from "@/lib/intended-pricing"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronLeft, SearchIcon } from "lucide-react"

const CURRENCY_OPTIONS = ["RWF", "USD", "CNY", "AED"] as const
const PRODUCTS_PER_PAGE = 10

type PickupMethod = "easy" | "advanced"

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
    trackingId: "",
    pickupMethod: "easy" as PickupMethod,
    intlShipping: "",
    intlShippingCurrency: "USD",
    intlShippingExchangeRate: "",
    warehouseUSA: "",
    warehouseUSACurrency: "USD",
    warehouseUSAExchangeRate: "",
    amazonPrime: "",
    amazonPrimeCurrency: "USD",
    amazonPrimeExchangeRate: "",
    collectionFee: "",
    localTransport: "",
    customsDuties: "",
    declaration: "",
    arrivalNotif: "",
    warehouseStorage: "",
    miscellaneous: "",
}

const expenseFieldKeys = [
    "collectionFee",
    "localTransport",
    "customsDuties",
    "declaration",
    "arrivalNotif",
    "warehouseStorage",
    "miscellaneous",
] as const

export function BatchCreatePage() {
    const router = useRouter()

    const [products, setProducts] = React.useState<Product[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [form, setForm] = React.useState(initialBatchForm)
    const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([])
    const [errors, setErrors] = React.useState<Record<string, string>>({})

    const [productSearch, setProductSearch] = React.useState("")
    const [productPage, setProductPage] = React.useState(1)
    const productSearchInputRef = React.useRef<HTMLInputElement | null>(null)
    const submitIntentRef = React.useRef(false)

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

    const hasAnyExpenseAmount = React.useCallback((nextForm: typeof initialBatchForm) => {
        return expenseFieldKeys.some((key) => Number(stripCommas(nextForm[key]) || 0) > 0)
    }, [])

    const canCreateBatch = hasAnyExpenseAmount(form)

    const unassignedProducts = React.useMemo(
        () => products.filter((product) => !product.batchId?._id),
        [products]
    )

    const filteredUnassignedProducts = React.useMemo(() => {
        const searchLower = productSearch.toLowerCase().trim()
        if (!searchLower) {
            return unassignedProducts
        }

        return unassignedProducts.filter((product) => product.name.toLowerCase().includes(searchLower))
    }, [unassignedProducts, productSearch])

    const totalProductPages = Math.max(1, Math.ceil(filteredUnassignedProducts.length / PRODUCTS_PER_PAGE))

    const paginatedUnassignedProducts = React.useMemo(() => {
        const start = (productPage - 1) * PRODUCTS_PER_PAGE
        return filteredUnassignedProducts.slice(start, start + PRODUCTS_PER_PAGE)
    }, [filteredUnassignedProducts, productPage])

    const selectedProducts = React.useMemo(() => {
        const selectedIdSet = new Set(selectedProductIds)
        return products.filter((product) => selectedIdSet.has(product._id))
    }, [products, selectedProductIds])
    const intendedSellingPricesByProductId = React.useMemo(() => getAllIntendedSellingPrices(), [products])

    const parsedCosts = React.useMemo(() => {
        return {
            intlShipping: convertInternationalExpenseToRwf(
                Number(stripCommas(form.intlShipping) || 0),
                form.intlShippingCurrency,
                Number(stripCommas(form.intlShippingExchangeRate) || 1)
            ),
            taxValue: 0,
            collectionFee: Number(stripCommas(form.collectionFee) || 0),
            customsDuties: Number(stripCommas(form.customsDuties) || 0),
            declaration: Number(stripCommas(form.declaration) || 0),
            arrivalNotif: Number(stripCommas(form.arrivalNotif) || 0),
            warehouseStorage: Number(stripCommas(form.warehouseStorage) || 0),
            localTransport: Number(stripCommas(form.localTransport) || 0),
            amazonPrime: convertInternationalExpenseToRwf(
                Number(stripCommas(form.amazonPrime) || 0),
                form.amazonPrimeCurrency,
                Number(stripCommas(form.amazonPrimeExchangeRate) || 1)
            ),
            warehouseUSA: convertInternationalExpenseToRwf(
                Number(stripCommas(form.warehouseUSA) || 0),
                form.warehouseUSACurrency,
                Number(stripCommas(form.warehouseUSAExchangeRate) || 1)
            ),
            miscellaneous: Number(stripCommas(form.miscellaneous) || 0),
        }
    }, [form])

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

    const loadProducts = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/products")
            if (!response.ok) {
                return [] as Product[]
            }

            const data = await response.json()
            const nextProducts = (data.products ?? []) as Product[]
            setProducts(nextProducts)
            return nextProducts
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void loadProducts()
    }, [loadProducts])

    const handleProductCreated = React.useCallback(async () => {
        const nextProducts = await loadProducts()
        const nextIds = new Set(nextProducts.map((product) => product._id))
        setSelectedProductIds((current) => current.filter((id) => nextIds.has(id)))
    }, [loadProducts])

    React.useEffect(() => {
        const handleSearchShortcut = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
                event.preventDefault()
                productSearchInputRef.current?.focus()
                productSearchInputRef.current?.select()
            }
        }

        window.addEventListener("keydown", handleSearchShortcut)
        return () => window.removeEventListener("keydown", handleSearchShortcut)
    }, [])

    React.useEffect(() => {
        setProductPage(1)
    }, [productSearch])

    React.useEffect(() => {
        setProductPage((current) => Math.min(current, totalProductPages))
    }, [totalProductPages])

    const renderFieldError = (field: string) => {
        if (!errors[field]) {
            return null
        }

        return <p className="text-xs text-destructive">{errors[field]}</p>
    }

    const handlePickupMethodChange = (method: PickupMethod) => {
        setForm((current) => {
            if (method === current.pickupMethod) {
                return current
            }

            if (method === "easy") {
                return {
                    ...current,
                    pickupMethod: "easy",
                    customsDuties: "",
                    declaration: "",
                    arrivalNotif: "",
                    warehouseStorage: "",
                    localTransport: "",
                    miscellaneous: "",
                }
            }

            return {
                ...current,
                pickupMethod: "advanced",
                collectionFee: "",
                localTransport: "",
            }
        })
    }

    const handleCurrencyChange = React.useCallback(
        (field: "intlShippingCurrency" | "warehouseUSACurrency" | "amazonPrimeCurrency", value: string) => {
            setForm((current) => {
                if (current[field] === value) {
                    return current
                }

                return { ...current, [field]: value }
            })
        },
        []
    )

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!submitIntentRef.current) {
            return
        }

        submitIntentRef.current = false
        setIsSubmitting(true)
        setErrors({})

        try {
            if (!hasAnyExpenseAmount(form)) {
                setErrors({ general: "Add at least one expense amount" })
                return
            }

            const nextErrors: Record<string, string> = {}
            const toAmount = (value: string) => Number(stripCommas(value) || 0)

            const convertToRwf = (
                amount: number,
                currency: string,
                exchangeRate: string,
                fieldPrefix: "intlShipping" | "warehouseUSA" | "amazonPrime"
            ) => {
                if (!Number.isFinite(amount) || amount < 0) {
                    nextErrors[fieldPrefix] = "Value must be 0 or higher"
                    return 0
                }

                if (amount <= 0) {
                    return 0
                }

                if (currency === "RWF") {
                    return amount
                }

                const parsedRate = Number(stripCommas(exchangeRate) || 0)
                if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
                    nextErrors[`${fieldPrefix}ExchangeRate`] = "Exchange rate is required for non-RWF amounts"
                    return 0
                }

                return amount * parsedRate
            }

            const intlShippingAmount = toAmount(form.intlShipping)
            const warehouseUSAAmount = toAmount(form.warehouseUSA)
            const amazonPrimeAmount = toAmount(form.amazonPrime)

            convertToRwf(intlShippingAmount, form.intlShippingCurrency, form.intlShippingExchangeRate, "intlShipping")
            convertToRwf(warehouseUSAAmount, form.warehouseUSACurrency, form.warehouseUSAExchangeRate, "warehouseUSA")
            convertToRwf(amazonPrimeAmount, form.amazonPrimeCurrency, form.amazonPrimeExchangeRate, "amazonPrime")

            const easyCollectionFee = toAmount(form.collectionFee)
            const easyTransport = toAmount(form.localTransport)

            const advancedCustomsDuties = toAmount(form.customsDuties)
            const advancedArrivalNotif = toAmount(form.arrivalNotif)
            const advancedWarehouseStorage = toAmount(form.warehouseStorage)
            const advancedDeclaration = toAmount(form.declaration)
            const advancedLocalTransport = toAmount(form.localTransport)
            const advancedMiscellaneous = toAmount(form.miscellaneous)

            const localNumbers = form.pickupMethod === "easy"
                ? {
                    collectionFee: easyCollectionFee,
                    localTransport: easyTransport,
                    customsDuties: 0,
                    arrivalNotif: 0,
                    warehouseStorage: 0,
                    declaration: 0,
                    miscellaneous: 0,
                }
                : {
                    collectionFee: 0,
                    localTransport: advancedLocalTransport,
                    customsDuties: advancedCustomsDuties,
                    arrivalNotif: advancedArrivalNotif,
                    warehouseStorage: advancedWarehouseStorage,
                    declaration: advancedDeclaration,
                    miscellaneous: advancedMiscellaneous,
                }

            for (const [field, value] of Object.entries(localNumbers)) {
                if (!Number.isFinite(value) || value < 0) {
                    nextErrors[field] = "Value must be 0 or higher"
                }
            }

            if (Object.keys(nextErrors).length > 0) {
                setErrors(nextErrors)
                return
            }

            const requestPayload = {
                batchName: form.batchName.trim(),
                trackingId: form.trackingId.trim(),
                pickupMethod: form.pickupMethod,
                intlShipping: intlShippingAmount,
                intlShippingCurrency: form.intlShippingCurrency,
                intlShippingExchangeRate: form.intlShippingCurrency === "RWF"
                    ? 1
                    : Number(stripCommas(form.intlShippingExchangeRate) || 1),
                warehouseUSA: warehouseUSAAmount,
                warehouseUSACurrency: form.warehouseUSACurrency,
                warehouseUSAExchangeRate: form.warehouseUSACurrency === "RWF"
                    ? 1
                    : Number(stripCommas(form.warehouseUSAExchangeRate) || 1),
                amazonPrime: amazonPrimeAmount,
                amazonPrimeCurrency: form.amazonPrimeCurrency,
                amazonPrimeExchangeRate: form.amazonPrimeCurrency === "RWF"
                    ? 1
                    : Number(stripCommas(form.amazonPrimeExchangeRate) || 1),
                taxValue: 0,
                collectionFee: localNumbers.collectionFee,
                customsDuties: localNumbers.customsDuties,
                arrivalNotif: localNumbers.arrivalNotif,
                warehouseStorage: localNumbers.warehouseStorage,
                declaration: localNumbers.declaration,
                localTransport: localNumbers.localTransport,
                miscellaneous: localNumbers.miscellaneous,
            }

            const response = await fetch("/api/batches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestPayload),
            })

            const data = await safeReadJson(response)
            if (!response.ok) {
                const apiErrors = (data?.errors ?? null) as Record<string, string> | null
                setErrors(apiErrors ?? { general: "Failed to create batch" })
                return
            }

            const createdBatchId = (data?.batch as { _id?: string } | undefined)?._id
            if (createdBatchId && selectedProductIds.length > 0) {
                const syncResponse = await fetch(`/api/batches/${createdBatchId}/products`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productIds: selectedProductIds }),
                })

                if (!syncResponse.ok) {
                    const syncData = await safeReadJson(syncResponse)
                    const syncErrors = (syncData?.errors ?? null) as Record<string, string> | null
                    setErrors(syncErrors ?? { general: "Batch created, but product assignment failed" })
                    return
                }
            }

            router.push("/app/batches")
            router.refresh()
        } finally {
            setIsSubmitting(false)
        }
    }

    const renderProductSelector = () => {
        if (unassignedProducts.length === 0) {
            return (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No unassigned products available yet.
                </div>
            )
        }

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="relative w-full sm:w-64">
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={productSearchInputRef}
                            value={productSearch}
                            onChange={(event) => setProductSearch(event.target.value)}
                            placeholder="Search products"
                            className="pr-18 pl-9"
                        />
                        <KbdGroup className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex">
                            <Kbd>Ctrl</Kbd>
                            <Kbd>F</Kbd>
                        </KbdGroup>
                    </div>
                    <AddProductSheet onProductCreated={handleProductCreated} />
                </div>

                <div className="overflow-hidden rounded-md border">
                    {filteredUnassignedProducts.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">
                            No products found matching your search.
                        </div>
                    ) : paginatedUnassignedProducts.map((product, index) => {
                        const isSelected = selectedProductIds.includes(product._id)

                        return (
                            <div
                                key={product._id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                    setSelectedProductIds((current) =>
                                        current.includes(product._id)
                                            ? current.filter((id) => id !== product._id)
                                            : [...current, product._id]
                                    )
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== "Enter" && event.key !== " ") {
                                        return
                                    }
                                    event.preventDefault()
                                    setSelectedProductIds((current) =>
                                        current.includes(product._id)
                                            ? current.filter((id) => id !== product._id)
                                            : [...current, product._id]
                                    )
                                }}
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0",
                                    index === 0 && "rounded-t-md",
                                    index === paginatedUnassignedProducts.length - 1 && "rounded-b-md",
                                    isSelected
                                        ? "bg-primary/20 text-foreground hover:bg-primary/20"
                                        : "hover:bg-muted/40"
                                )}
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        "flex size-4 shrink-0 items-center justify-center rounded-lg border border-input",
                                        isSelected ? "border-primary bg-primary text-primary-foreground" : "bg-background"
                                    )}
                                >
                                    {isSelected ? <CheckIcon className="size-3" /> : null}
                                </span>
                                <span className="min-w-0 flex-1 truncate" title={product.name}>{product.name}</span>
                                {isSelected ? <CheckIcon className="ml-auto h-4 w-4" /> : null}
                            </div>
                        )
                    })}
                </div>

                {filteredUnassignedProducts.length > PRODUCTS_PER_PAGE ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                            Showing {(productPage - 1) * PRODUCTS_PER_PAGE + 1}
                            -
                            {Math.min(productPage * PRODUCTS_PER_PAGE, filteredUnassignedProducts.length)}
                            of {filteredUnassignedProducts.length}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={productPage <= 1}
                                onClick={() => setProductPage((current) => Math.max(1, current - 1))}
                            >
                                Previous
                            </Button>
                            <span>Page {productPage} of {totalProductPages}</span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={productPage >= totalProductPages}
                                onClick={() => setProductPage((current) => Math.min(totalProductPages, current + 1))}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                ) : null}
            </div>
        )
    }

    const renderSelectedProductsTable = () => {
        if (selectedProducts.length === 0) {
            return (
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    Add products from the list above to build this batch.
                </div>
            )
        }

        const totals = selectedProducts.reduce(
            (acc, product) => {
                const preview = allocationPreviewByProductId.get(product._id)
                const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                const baseTotal = baseUnitPrice * product.quantityInitial
                const finalUnit = preview ? preview.landedCost : baseUnitPrice
                const finalTotal = finalUnit * product.quantityInitial
                const shippingShare = Math.max(0, finalTotal - baseTotal)

                return {
                    quantity: acc.quantity + product.quantityInitial,
                    baseTotal: acc.baseTotal + baseTotal,
                    weightPercentage: acc.weightPercentage + (preview?.weightPercentage ?? 0),
                    shippingShare: acc.shippingShare + shippingShare,
                    finalTotal: acc.finalTotal + finalTotal,
                }
            },
            { quantity: 0, baseTotal: 0, weightPercentage: 0, shippingShare: 0, finalTotal: 0 }
        )

        return (
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Vendor Price (RWF)</TableHead>
                            <TableHead className="text-right">Vendor Total (RWF)</TableHead>
                            <TableHead className="text-right">Import Charges (RWF)</TableHead>
                            <TableHead className="text-right">Weight %</TableHead>
                            <TableHead className="text-right">Selling Price (RWF)</TableHead>
                            <TableHead className="text-right">Total Landed Costs (RWF)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedProducts.map((product) => {
                            const preview = allocationPreviewByProductId.get(product._id)
                            const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                            const productTotal = baseUnitPrice * product.quantityInitial
                            const finalUnit = preview ? preview.landedCost : baseUnitPrice
                            const finalTotal = finalUnit * product.quantityInitial
                            const importCharges = Math.max(0, finalTotal - productTotal)
                            const intendedSellingPrice = intendedSellingPricesByProductId[product._id]

                            return (
                                <TableRow key={product._id}>
                                    <TableCell className="truncate max-w-xs font-medium">{product.name}</TableCell>
                                    <TableCell className="text-right">{product.quantityInitial.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{baseUnitPrice.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{productTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right">
                                        {importCharges.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {preview ? `${preview.weightPercentage.toFixed(2)}%` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {typeof intendedSellingPrice === "number"
                                            ? intendedSellingPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                            : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                        <TableRow className="bg-muted/30 font-semibold">
                            <TableCell>Totals</TableCell>
                            <TableCell className="text-right">{totals.quantity.toLocaleString()}</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">{totals.baseTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{totals.shippingShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                            <TableCell className="text-right">{`${totals.weightPercentage.toFixed(2)}%`}</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right">{totals.finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>
        )
    }

    const renderProductsTableSkeleton = () => (
        <div className="overflow-hidden rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Vendor Price (RWF)</TableHead>
                        <TableHead className="text-right">Vendor Total (RWF)</TableHead>
                        <TableHead className="text-right">Import Charges (RWF)</TableHead>
                        <TableHead className="text-right">Weight %</TableHead>
                        <TableHead className="text-right">Selling Price (RWF)</TableHead>
                        <TableHead className="text-right">Total Landed Costs (RWF)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[0, 1, 2, 3].map((index) => (
                        <TableRow key={`create-batch-products-loading-${index}`}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-14" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )

    return (
        <form className="flex flex-1 flex-col gap-4 p-4 lg:p-6" onSubmit={submit} onKeyDown={preventImplicitSubmitOnEnter}>
            <div className="mb-1 flex items-center gap-3">
                <Button variant="outline" className="h-9 w-9 p-0" type="button" onClick={() => router.push("/app/batches")}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-sm font-medium text-muted-foreground">Back to Batches</p>
            </div>

            <CardHeader className="flex items-center justify-between gap-3 px-0">
                <div>
                    <CardTitle className="text-2xl font-bold">Create Batch</CardTitle>
                    <CardDescription>Enter batch details and select products.</CardDescription>
                </div>
            </CardHeader>

            {!canCreateBatch ? (
                <p className="text-xs text-muted-foreground">Add at least one expense amount.</p>
            ) : null}

            <div className="grid gap-1.5">
                <label htmlFor="batch-name" className="text-sm font-medium">Batch name</label>
                <Input
                    id="batch-name"
                    placeholder="Batch name"
                    value={form.batchName}
                    onChange={(event) => setForm((current) => ({ ...current, batchName: event.target.value }))}
                />
                {renderFieldError("batchName")}
            </div>

            <div className="grid gap-1.5">
                <label htmlFor="tracking-id" className="text-sm font-medium">Tracking number</label>
                <Input
                    id="tracking-id"
                    placeholder="Optional tracking number"
                    value={form.trackingId}
                    onChange={(event) => setForm((current) => ({ ...current, trackingId: event.target.value }))}
                />
            </div>

            <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-semibold">International Expenses</p>

                <div className="grid gap-3 lg:grid-cols-3">
                    <div className="grid gap-1.5">
                        <label htmlFor="intl-shipping" className="text-sm font-medium">Intl shipping</label>
                        <Input
                            id="intl-shipping"
                            placeholder="Intl shipping"
                            type="text"
                            inputMode="decimal"
                            value={form.intlShipping}
                            onChange={(event) => setForm((current) => ({ ...current, intlShipping: toDecimalInput(event.target.value) }))}
                        />
                        {renderFieldError("intlShipping")}
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Currency</label>
                        <select
                            value={form.intlShippingCurrency}
                            onChange={(event) => handleCurrencyChange("intlShippingCurrency", event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        >
                            {CURRENCY_OPTIONS.map((currency) => (
                                <option key={`intl-${currency}`} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Exchange rate</label>
                        <Input
                            placeholder={form.intlShippingCurrency === "RWF" ? "Not needed for RWF" : "Rate to RWF"}
                            type="text"
                            inputMode="decimal"
                            disabled={form.intlShippingCurrency === "RWF"}
                            value={form.intlShippingExchangeRate}
                            onChange={(event) => setForm((current) => ({ ...current, intlShippingExchangeRate: toDecimalInput(event.target.value) }))}
                        />
                        {renderFieldError("intlShippingExchangeRate")}
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                    <div className="grid gap-1.5">
                        <label htmlFor="warehouse-usa" className="text-sm font-medium">Warehouse USA</label>
                        <Input
                            id="warehouse-usa"
                            placeholder="Warehouse USA"
                            type="text"
                            inputMode="decimal"
                            value={form.warehouseUSA}
                            onChange={(event) => setForm((current) => ({ ...current, warehouseUSA: toDecimalInput(event.target.value) }))}
                        />
                        {renderFieldError("warehouseUSA")}
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Currency</label>
                        <select
                            value={form.warehouseUSACurrency}
                            onChange={(event) => handleCurrencyChange("warehouseUSACurrency", event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        >
                            {CURRENCY_OPTIONS.map((currency) => (
                                <option key={`warehouse-${currency}`} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Exchange rate</label>
                        <Input
                            placeholder={form.warehouseUSACurrency === "RWF" ? "Not needed for RWF" : "Rate to RWF"}
                            type="text"
                            inputMode="decimal"
                            disabled={form.warehouseUSACurrency === "RWF"}
                            value={form.warehouseUSAExchangeRate}
                            onChange={(event) => setForm((current) => ({ ...current, warehouseUSAExchangeRate: toDecimalInput(event.target.value) }))}
                        />
                        {renderFieldError("warehouseUSAExchangeRate")}
                    </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                    <div className="grid gap-1.5">
                        <label htmlFor="amazon-prime" className="text-sm font-medium">Amazon Prime</label>
                        <Input
                            id="amazon-prime"
                            placeholder="Amazon Prime"
                            type="text"
                            inputMode="decimal"
                            value={form.amazonPrime}
                            onChange={(event) => setForm((current) => ({ ...current, amazonPrime: toDecimalInput(event.target.value) }))}
                        />
                        {renderFieldError("amazonPrime")}
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Currency</label>
                        <select
                            value={form.amazonPrimeCurrency}
                            onChange={(event) => handleCurrencyChange("amazonPrimeCurrency", event.target.value)}
                            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                        >
                            {CURRENCY_OPTIONS.map((currency) => (
                                <option key={`prime-${currency}`} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-1.5">
                        <label className="text-sm font-medium">Exchange rate</label>
                        <Input
                            placeholder={form.amazonPrimeCurrency === "RWF" ? "Not needed for RWF" : "Rate to RWF"}
                            type="text"
                            inputMode="decimal"
                            disabled={form.amazonPrimeCurrency === "RWF"}
                            value={form.amazonPrimeExchangeRate}
                            onChange={(event) => setForm((current) => ({ ...current, amazonPrimeExchangeRate: toDecimalInput(event.target.value) }))}
                        />
                        {renderFieldError("amazonPrimeExchangeRate")}
                    </div>
                </div>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
                <p className="text-sm font-semibold">Local Expenses (RWF)</p>
                <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Pickup method</p>
                    <div className="inline-flex rounded-md border bg-muted p-1">
                        <button
                            type="button"
                            className={cn(
                                "rounded px-3 py-1.5 text-sm",
                                form.pickupMethod === "easy" ? "bg-background shadow-sm" : "text-muted-foreground"
                            )}
                            onClick={() => handlePickupMethodChange("easy")}
                        >
                            Easy
                        </button>
                        <button
                            type="button"
                            className={cn(
                                "rounded px-3 py-1.5 text-sm",
                                form.pickupMethod === "advanced" ? "bg-background shadow-sm" : "text-muted-foreground"
                            )}
                            onClick={() => handlePickupMethodChange("advanced")}
                        >
                            Advanced
                        </button>
                    </div>
                </div>

                {form.pickupMethod === "easy" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <label htmlFor="collection-fee" className="text-sm font-medium">Collection Fee (RWF)</label>
                            <Input
                                id="collection-fee"
                                placeholder="Collection Fee"
                                type="text"
                                inputMode="decimal"
                                value={form.collectionFee}
                                onChange={(event) => setForm((current) => ({ ...current, collectionFee: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("collectionFee")}
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="local-transport-easy" className="text-sm font-medium">Transport (RWF)</label>
                            <Input
                                id="local-transport-easy"
                                placeholder="Transport"
                                type="text"
                                inputMode="decimal"
                                value={form.localTransport}
                                onChange={(event) => setForm((current) => ({ ...current, localTransport: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("localTransport")}
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5">
                            <label htmlFor="customs-duties" className="text-sm font-medium">Custom Duties (Tax)</label>
                            <Input
                                id="customs-duties"
                                placeholder="Custom Duties"
                                type="text"
                                inputMode="decimal"
                                value={form.customsDuties}
                                onChange={(event) => setForm((current) => ({ ...current, customsDuties: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("customsDuties")}
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="arrival-notif" className="text-sm font-medium">Arrival Not.</label>
                            <Input
                                id="arrival-notif"
                                placeholder="Arrival Not."
                                type="text"
                                inputMode="decimal"
                                value={form.arrivalNotif}
                                onChange={(event) => setForm((current) => ({ ...current, arrivalNotif: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("arrivalNotif")}
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="warehouse-storage" className="text-sm font-medium">Warehouse</label>
                            <Input
                                id="warehouse-storage"
                                placeholder="Warehouse"
                                type="text"
                                inputMode="decimal"
                                value={form.warehouseStorage}
                                onChange={(event) => setForm((current) => ({ ...current, warehouseStorage: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("warehouseStorage")}
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="declaration" className="text-sm font-medium">Declaration</label>
                            <Input
                                id="declaration"
                                placeholder="Declaration"
                                type="text"
                                inputMode="decimal"
                                value={form.declaration}
                                onChange={(event) => setForm((current) => ({ ...current, declaration: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("declaration")}
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="local-transport-advanced" className="text-sm font-medium">Local Transport</label>
                            <Input
                                id="local-transport-advanced"
                                placeholder="Local Transport"
                                type="text"
                                inputMode="decimal"
                                value={form.localTransport}
                                onChange={(event) => setForm((current) => ({ ...current, localTransport: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("localTransport")}
                        </div>
                        <div className="grid gap-1.5">
                            <label htmlFor="miscellaneous" className="text-sm font-medium">Miscellaneous</label>
                            <Input
                                id="miscellaneous"
                                placeholder="Miscellaneous"
                                type="text"
                                inputMode="decimal"
                                value={form.miscellaneous}
                                onChange={(event) => setForm((current) => ({ ...current, miscellaneous: toDecimalInput(event.target.value) }))}
                            />
                            {renderFieldError("miscellaneous")}
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium">Select Products</p>
                {isLoading ? renderProductsTableSkeleton() : renderProductSelector()}
            </div>

            <div className="space-y-2">
                <p className="text-sm font-medium">Selected Products</p>
                {isLoading ? renderProductsTableSkeleton() : renderSelectedProductsTable()}
            </div>

            {errors.general ? <p className="text-sm text-destructive">{errors.general}</p> : null}

            <div className="flex items-center justify-end gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size={"lg"}
                    className="h-10 px-6"
                    onClick={() => router.push("/app/batches")}
                    disabled={isSubmitting}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    size={"lg"}
                    className="h-10 px-6 disabled:opacity-50"
                    disabled={isSubmitting || !canCreateBatch}
                    onClick={() => {
                        submitIntentRef.current = true
                    }}
                >
                    {isSubmitting ? "Saving..." : "Create Batch"}
                </Button>
            </div>

        </form>
    )
}
