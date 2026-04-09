"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
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
import { Skeleton } from "@/components/ui/skeleton"
import { calculateBatchProductLandedCosts, convertInternationalExpenseToRwf } from "@/lib/costs"
import { cn } from "@/lib/utils"
import { ChevronLeft, CopyIcon, PackageOpen, SearchIcon } from "lucide-react"

const CURRENCY_OPTIONS = ["RWF", "USD", "CNY", "AED"] as const
const PRODUCTS_PER_PAGE = 10

type Batch = {
    _id: string
    batchName: string
    trackingId?: string
    pickupMethod?: "easy" | "advanced"
    intlShipping: number
    intlShippingCurrency?: string
    intlShippingExchangeRate?: number
    taxValue: number
    collectionFee?: number
    customsDuties: number
    declaration: number
    arrivalNotif: number
    warehouseStorage: number
    localTransport?: number
    amazonPrime: number
    amazonPrimeCurrency?: string
    amazonPrimeExchangeRate?: number
    warehouseUSA: number
    warehouseUSACurrency?: string
    warehouseUSAExchangeRate?: number
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
    trackingId: "",
    pickupMethod: "advanced" as "easy" | "advanced",
    intlShipping: "0",
    intlShippingCurrency: "RWF",
    intlShippingExchangeRate: "1",
    taxValue: "0",
    collectionFee: "0",
    customsDuties: "0",
    declaration: "0",
    arrivalNotif: "0",
    warehouseStorage: "0",
    localTransport: "0",
    amazonPrime: "0",
    amazonPrimeCurrency: "RWF",
    amazonPrimeExchangeRate: "1",
    warehouseUSA: "0",
    warehouseUSACurrency: "RWF",
    warehouseUSAExchangeRate: "1",
    miscellaneous: "0",
}

const expenseFieldKeys = [
    "intlShipping",
    "taxValue",
    "collectionFee",
    "customsDuties",
    "declaration",
    "arrivalNotif",
    "warehouseStorage",
    "localTransport",
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
    const [initialForm, setInitialForm] = React.useState(initialBatchForm)
    const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([])
    const [initialSelectedProductIds, setInitialSelectedProductIds] = React.useState<string[]>([])
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [isEditing, setIsEditing] = React.useState(false)
    const [productSearch, setProductSearch] = React.useState("")
    const [productPage, setProductPage] = React.useState(1)
    const productSearchInputRef = React.useRef<HTMLInputElement | null>(null)

    const preventImplicitSubmitOnEnter = React.useCallback((event: React.KeyboardEvent<HTMLFormElement>) => {
        if (event.key !== "Enter") {
            return
        }

        const target = event.target
        if (!(target instanceof HTMLElement)) {
            return
        }

        if (target.tagName === "TEXTAREA") {
            return
        }

        if (target.getAttribute("role") === "combobox") {
            return
        }

        event.preventDefault()
    }, [])

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
        trackingId: batch.trackingId ?? "",
        pickupMethod: batch.pickupMethod ?? "advanced",
        intlShipping: String(batch.intlShipping ?? 0),
        intlShippingCurrency: batch.intlShippingCurrency ?? "RWF",
        intlShippingExchangeRate: String(batch.intlShippingExchangeRate ?? 1),
        taxValue: String(batch.taxValue ?? 0),
        collectionFee: String(batch.collectionFee ?? 0),
        customsDuties: String(batch.customsDuties ?? 0),
        declaration: String(batch.declaration ?? 0),
        arrivalNotif: String(batch.arrivalNotif ?? 0),
        warehouseStorage: String(batch.warehouseStorage ?? 0),
        localTransport: String(batch.localTransport ?? 0),
        amazonPrime: String(batch.amazonPrime ?? 0),
        amazonPrimeCurrency: batch.amazonPrimeCurrency ?? "RWF",
        amazonPrimeExchangeRate: String(batch.amazonPrimeExchangeRate ?? 1),
        warehouseUSA: String(batch.warehouseUSA ?? 0),
        warehouseUSACurrency: batch.warehouseUSACurrency ?? "RWF",
        warehouseUSAExchangeRate: String(batch.warehouseUSAExchangeRate ?? 1),
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

    const canSave = hasAnyExpenseAmount(form)

    const normalizedFormSignature = React.useMemo(() => {
        return JSON.stringify({
            batchName: form.batchName.trim(),
            trackingId: form.trackingId.trim(),
            pickupMethod: form.pickupMethod,
            intlShipping: Number(stripCommas(form.intlShipping) || 0),
            intlShippingCurrency: form.intlShippingCurrency,
            intlShippingExchangeRate: Number(stripCommas(form.intlShippingExchangeRate) || 1),
            taxValue: Number(stripCommas(form.taxValue) || 0),
            collectionFee: Number(stripCommas(form.collectionFee) || 0),
            customsDuties: Number(stripCommas(form.customsDuties) || 0),
            declaration: Number(stripCommas(form.declaration) || 0),
            arrivalNotif: Number(stripCommas(form.arrivalNotif) || 0),
            warehouseStorage: Number(stripCommas(form.warehouseStorage) || 0),
            localTransport: Number(stripCommas(form.localTransport) || 0),
            amazonPrime: Number(stripCommas(form.amazonPrime) || 0),
            amazonPrimeCurrency: form.amazonPrimeCurrency,
            amazonPrimeExchangeRate: Number(stripCommas(form.amazonPrimeExchangeRate) || 1),
            warehouseUSA: Number(stripCommas(form.warehouseUSA) || 0),
            warehouseUSACurrency: form.warehouseUSACurrency,
            warehouseUSAExchangeRate: Number(stripCommas(form.warehouseUSAExchangeRate) || 1),
            miscellaneous: Number(stripCommas(form.miscellaneous) || 0),
        })
    }, [form])

    const normalizedInitialFormSignature = React.useMemo(() => {
        return JSON.stringify({
            batchName: initialForm.batchName.trim(),
            trackingId: initialForm.trackingId.trim(),
            pickupMethod: initialForm.pickupMethod,
            intlShipping: Number(stripCommas(initialForm.intlShipping) || 0),
            intlShippingCurrency: initialForm.intlShippingCurrency,
            intlShippingExchangeRate: Number(stripCommas(initialForm.intlShippingExchangeRate) || 1),
            taxValue: Number(stripCommas(initialForm.taxValue) || 0),
            collectionFee: Number(stripCommas(initialForm.collectionFee) || 0),
            customsDuties: Number(stripCommas(initialForm.customsDuties) || 0),
            declaration: Number(stripCommas(initialForm.declaration) || 0),
            arrivalNotif: Number(stripCommas(initialForm.arrivalNotif) || 0),
            warehouseStorage: Number(stripCommas(initialForm.warehouseStorage) || 0),
            localTransport: Number(stripCommas(initialForm.localTransport) || 0),
            amazonPrime: Number(stripCommas(initialForm.amazonPrime) || 0),
            amazonPrimeCurrency: initialForm.amazonPrimeCurrency,
            amazonPrimeExchangeRate: Number(stripCommas(initialForm.amazonPrimeExchangeRate) || 1),
            warehouseUSA: Number(stripCommas(initialForm.warehouseUSA) || 0),
            warehouseUSACurrency: initialForm.warehouseUSACurrency,
            warehouseUSAExchangeRate: Number(stripCommas(initialForm.warehouseUSAExchangeRate) || 1),
            miscellaneous: Number(stripCommas(initialForm.miscellaneous) || 0),
        })
    }, [initialForm])

    const selectedIdsSignature = React.useMemo(() => {
        return [...selectedProductIds].sort().join("|")
    }, [selectedProductIds])

    const initialSelectedIdsSignature = React.useMemo(() => {
        return [...initialSelectedProductIds].sort().join("|")
    }, [initialSelectedProductIds])

    const hasChanges = normalizedFormSignature !== normalizedInitialFormSignature || selectedIdsSignature !== initialSelectedIdsSignature

    const parsedCosts = React.useMemo(() => {
        return {
            intlShipping: convertInternationalExpenseToRwf(
                Number(stripCommas(form.intlShipping) || 0),
                form.intlShippingCurrency,
                Number(stripCommas(form.intlShippingExchangeRate) || 1)
            ),
            taxValue: Number(stripCommas(form.taxValue) || 0),
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

    const selectedProducts = React.useMemo(() => {
        const selectedIdSet = new Set(selectedProductIds)
        return products.filter((product) => selectedIdSet.has(product._id))
    }, [products, selectedProductIds])

    const filteredProducts = React.useMemo(() => {
        const searchLower = productSearch.toLowerCase().trim()
        if (!searchLower) {
            return products
        }

        return products.filter((product) => product.name.toLowerCase().includes(searchLower))
    }, [products, productSearch])

    const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE))

    const paginatedProducts = React.useMemo(() => {
        const start = (productPage - 1) * PRODUCTS_PER_PAGE
        return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE)
    }, [filteredProducts, productPage])

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

    const copyTrackingNumber = React.useCallback(async () => {
        if (!form.trackingId.trim()) {
            return
        }

        await navigator.clipboard.writeText(form.trackingId.trim())
    }, [form.trackingId])

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
                const [batchesRes, productsRes, assignedProductsRes] = await Promise.all([
                    fetch("/api/batches"),
                    fetch("/api/products"),
                    fetch(`/api/batches/${batchId}/products`),
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
                setInitialForm(formatBatchForm(currentBatch))

                let loadedProducts: Product[] = []
                if (productsRes.ok) {
                    const productsData = await productsRes.json()
                    loadedProducts = (productsData.products ?? []) as Product[]
                    setProducts(loadedProducts)
                }

                let nextSelectedProductIds: string[] = []
                if (assignedProductsRes.ok) {
                    const assignedProductsData = await assignedProductsRes.json()
                    nextSelectedProductIds = ((assignedProductsData.products ?? []) as Product[]).map((product) => product._id)
                } else if (loadedProducts.length > 0) {
                    nextSelectedProductIds = loadedProducts
                        .filter((product) => product.batchId?._id === batchId)
                        .map((product) => product._id)
                }

                setSelectedProductIds(nextSelectedProductIds)
                setInitialSelectedProductIds(nextSelectedProductIds)
            } finally {
                setIsLoading(false)
            }
        }

        load()
    }, [batchId])

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

            const payload = Object.fromEntries(
                Object.entries(form).map(([key, value]) => {
                    if (
                        key === "batchName" ||
                        key === "trackingId" ||
                        key === "pickupMethod" ||
                        key.endsWith("Currency")
                    ) {
                        return [key, value]
                    }
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

            setInitialForm(form)
            setInitialSelectedProductIds([...selectedProductIds])
            setIsEditing(false)
            return
        } finally {
            setIsSubmitting(false)
        }
    }

    const cancelEditing = () => {
        setForm(initialForm)
        setSelectedProductIds(initialSelectedProductIds)
        setErrors({})
        setIsEditing(false)
    }

    const handlePickupMethodChange = (method: "easy" | "advanced") => {
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

    const formatIntlDisplay = (amount: string, currency: string, exchangeRate: string) => {
        const formattedAmount = Number(stripCommas(amount) || 0).toLocaleString(undefined, {
            maximumFractionDigits: 2,
        })

        if (currency === "RWF") {
            return `${formattedAmount} ${currency}`
        }

        const rateValue = Number(stripCommas(exchangeRate) || 0).toLocaleString(undefined, {
            maximumFractionDigits: 4,
        })
        return `${formattedAmount} ${currency} (Rate: ${rateValue})`
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
            <div className="space-y-3">
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

                <div className="overflow-hidden rounded-md border">
                    {filteredProducts.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground">
                            No products found matching your search.
                        </div>
                    ) : paginatedProducts.map((product, index) => {
                        const isSelected = selectedProductIds.includes(product._id)
                        const assignedBatchId = product.batchId?._id
                        const assignedBatchName = assignedBatchId ? batchIdToName.get(assignedBatchId) : null

                        return (
                            <button
                                key={product._id}
                                type="button"
                                onClick={() => {
                                    if (!isEditing) {
                                        return
                                    }
                                    setSelectedProductIds((current) =>
                                        current.includes(product._id)
                                            ? current.filter((id) => id !== product._id)
                                            : [...current, product._id]
                                    )
                                }}
                                className={cn(
                                    "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0",
                                    index === 0 && "rounded-t-md",
                                    index === paginatedProducts.length - 1 && "rounded-b-md",
                                    isSelected
                                        ? "bg-primary/20 text-foreground hover:bg-primary/20"
                                        : "hover:bg-muted/40"
                                )}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium" title={product.name}>{product.name}</p>
                                    <p className="text-xs text-muted-foreground">Assigned: {assignedBatchName ?? "Unassigned"}</p>
                                </div>
                                <Checkbox
                                    checked={isSelected}
                                    disabled={!isEditing}
                                    aria-label={`Select ${product.name}`}
                                />
                            </button>
                        )
                    })}
                </div>

                {filteredProducts.length > PRODUCTS_PER_PAGE ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                            Showing {(productPage - 1) * PRODUCTS_PER_PAGE + 1}
                            -
                            {Math.min(productPage * PRODUCTS_PER_PAGE, filteredProducts.length)}
                            of {filteredProducts.length}
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

    const renderBatchProductsTable = () => {
        if (selectedProducts.length === 0) {
            if (isEditing) {
                return (
                    <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                        Add products from the list above to build this batch.
                    </div>
                )
            }

            return (
                <Empty className="rounded-md border border-dashed p-6">
                    <EmptyHeader>
                        <EmptyMedia variant="icon" className="bg-transparent">
                            <PackageOpen className="size-6" />
                        </EmptyMedia>
                        <EmptyTitle>No products in this batch yet</EmptyTitle>
                        <EmptyDescription>
                            This batch is saved. Add products when you are ready to distribute costs.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                        <Button type="button" onClick={() => setIsEditing(true)}>
                            Add products
                        </Button>
                    </EmptyContent>
                </Empty>
            )
        }

        return (
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Base Unit (RWF)</TableHead>
                            <TableHead className="text-right">Total (RWF)</TableHead>
                            <TableHead className="text-right">Weight %</TableHead>
                            <TableHead className="text-right">After Distribution (RWF)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {selectedProducts.map((product) => {
                            const preview = allocationPreviewByProductId.get(product._id)
                            const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                            const productTotal = baseUnitPrice * product.quantityInitial

                            return (
                                <TableRow key={product._id}>
                                    <TableCell className="truncate max-w-xs font-medium">{product.name}</TableCell>
                                    <TableCell className="text-right">{product.quantityInitial.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{baseUnitPrice.toLocaleString()}</TableCell>
                                    <TableCell className="text-right">{productTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-right">
                                        {preview ? `${preview.weightPercentage.toFixed(2)}%` : "-"}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {preview
                                            ? preview.landedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                            : baseUnitPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
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
                        <TableHead className="text-right">Base Unit (RWF)</TableHead>
                        <TableHead className="text-right">Total (RWF)</TableHead>
                        <TableHead className="text-right">Weight %</TableHead>
                        <TableHead className="text-right">After Distribution (RWF)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {[0, 1, 2, 3].map((index) => (
                        <TableRow key={`batch-details-loading-${index}`}>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-14" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )

    if (isLoading) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                <CardHeader className="px-0">
                    <CardTitle className="text-2xl font-bold">Batch</CardTitle>
                </CardHeader>
                {renderProductsTableSkeleton()}
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

    const detailItems = [
        {
            label: "Intl shipping",
            amount: Number(stripCommas(form.intlShipping) || 0),
            value: formatIntlDisplay(form.intlShipping, form.intlShippingCurrency, form.intlShippingExchangeRate),
        },
        {
            label: "Warehouse USA",
            amount: Number(stripCommas(form.warehouseUSA) || 0),
            value: formatIntlDisplay(form.warehouseUSA, form.warehouseUSACurrency, form.warehouseUSAExchangeRate),
        },
        {
            label: "Amazon Prime",
            amount: Number(stripCommas(form.amazonPrime) || 0),
            value: formatIntlDisplay(form.amazonPrime, form.amazonPrimeCurrency, form.amazonPrimeExchangeRate),
        },
        {
            label: "Collection fee (RWF)",
            amount: Number(stripCommas(form.collectionFee) || 0),
            value: Number(stripCommas(form.collectionFee) || 0).toLocaleString(),
        },
        {
            label: "Customs duties (RWF)",
            amount: Number(stripCommas(form.customsDuties) || 0),
            value: Number(stripCommas(form.customsDuties) || 0).toLocaleString(),
        },
        {
            label: "Declaration (RWF)",
            amount: Number(stripCommas(form.declaration) || 0),
            value: Number(stripCommas(form.declaration) || 0).toLocaleString(),
        },
        {
            label: "Arrival notification (RWF)",
            amount: Number(stripCommas(form.arrivalNotif) || 0),
            value: Number(stripCommas(form.arrivalNotif) || 0).toLocaleString(),
        },
        {
            label: "Warehouse storage (RWF)",
            amount: Number(stripCommas(form.warehouseStorage) || 0),
            value: Number(stripCommas(form.warehouseStorage) || 0).toLocaleString(),
        },
        {
            label: "Local transport (RWF)",
            amount: Number(stripCommas(form.localTransport) || 0),
            value: Number(stripCommas(form.localTransport) || 0).toLocaleString(),
        },
        {
            label: "Miscellaneous (RWF)",
            amount: Number(stripCommas(form.miscellaneous) || 0),
            value: Number(stripCommas(form.miscellaneous) || 0).toLocaleString(),
        },
    ].filter((item) => item.amount > 0)

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
                    <CardTitle className="text-2xl font-bold">{form.batchName || "Batch"}</CardTitle>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Tracking number:</span>
                        <span className="font-medium text-foreground">{form.trackingId || "Not set"}</span>
                        {form.trackingId ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={copyTrackingNumber}
                                aria-label="Copy tracking number"
                            >
                                <CopyIcon className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size={"lg"}
                            className="h-10 px-6 disabled:opacity-50"
                            disabled={isSubmitting || !canSave || !hasChanges}
                        >
                            {isSubmitting ? "Saving..." : "Save"}
                        </Button>
                    </div>
                ) : (
                    <Button type="button" size={"lg"} className="h-10 px-6" onClick={() => setIsEditing(true)}>
                        Edit
                    </Button>
                )}
            </CardHeader>

            {isEditing && !canSave ? (
                <p className="text-xs text-muted-foreground">
                    Add at least one expense amount.
                </p>
            ) : null}

            {isEditing ? (
                <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="grid gap-1.5 sm:col-span-2">
                            <label htmlFor="batch-name" className="text-sm font-medium">Batch name</label>
                            <Input
                                id="batch-name"
                                value={form.batchName}
                                onChange={(event) => setForm((current) => ({ ...current, batchName: event.target.value }))}
                            />
                            {renderFieldError("batchName")}
                        </div>
                        <div className="grid gap-1.5 sm:col-span-2">
                            <label htmlFor="tracking-id" className="text-sm font-medium">Tracking number</label>
                            <Input
                                id="tracking-id"
                                placeholder="Optional tracking number"
                                value={form.trackingId}
                                onChange={(event) => setForm((current) => ({ ...current, trackingId: event.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-3">
                        <p className="text-sm font-semibold">International Expenses</p>

                        <div className="grid gap-3 lg:grid-cols-3">
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
                                <label className="text-sm font-medium">Currency</label>
                                <Select
                                    value={form.intlShippingCurrency}
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            intlShippingCurrency: value,
                                            intlShippingExchangeRate: value === "RWF" ? "1" : current.intlShippingExchangeRate,
                                        }))
                                    }
                                >
                                    <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCY_OPTIONS.map((currency) => (
                                            <SelectItem key={`edit-intl-${currency}`} value={currency}>{currency}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Exchange rate</label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    disabled={form.intlShippingCurrency === "RWF"}
                                    value={form.intlShippingExchangeRate}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, intlShippingExchangeRate: toDecimalInput(event.target.value) }))
                                    }
                                />
                                {renderFieldError("intlShippingExchangeRate")}
                            </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-3">
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
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Currency</label>
                                <Select
                                    value={form.warehouseUSACurrency}
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            warehouseUSACurrency: value,
                                            warehouseUSAExchangeRate: value === "RWF" ? "1" : current.warehouseUSAExchangeRate,
                                        }))
                                    }
                                >
                                    <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCY_OPTIONS.map((currency) => (
                                            <SelectItem key={`edit-warehouse-${currency}`} value={currency}>{currency}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Exchange rate</label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    disabled={form.warehouseUSACurrency === "RWF"}
                                    value={form.warehouseUSAExchangeRate}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, warehouseUSAExchangeRate: toDecimalInput(event.target.value) }))
                                    }
                                />
                                {renderFieldError("warehouseUSAExchangeRate")}
                            </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-3">
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
                                <label className="text-sm font-medium">Currency</label>
                                <Select
                                    value={form.amazonPrimeCurrency}
                                    onValueChange={(value) =>
                                        setForm((current) => ({
                                            ...current,
                                            amazonPrimeCurrency: value,
                                            amazonPrimeExchangeRate: value === "RWF" ? "1" : current.amazonPrimeExchangeRate,
                                        }))
                                    }
                                >
                                    <SelectTrigger><SelectValue placeholder="Currency" /></SelectTrigger>
                                    <SelectContent>
                                        {CURRENCY_OPTIONS.map((currency) => (
                                            <SelectItem key={`edit-prime-${currency}`} value={currency}>{currency}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-1.5">
                                <label className="text-sm font-medium">Exchange rate</label>
                                <Input
                                    type="text"
                                    inputMode="decimal"
                                    disabled={form.amazonPrimeCurrency === "RWF"}
                                    value={form.amazonPrimeExchangeRate}
                                    onChange={(event) =>
                                        setForm((current) => ({ ...current, amazonPrimeExchangeRate: toDecimalInput(event.target.value) }))
                                    }
                                />
                                {renderFieldError("amazonPrimeExchangeRate")}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-3">
                        <p className="text-sm font-semibold">Local Expenses (RWF)</p>
                        <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Pickup method</p>
                            <div className="inline-flex rounded-md border bg-muted/20 p-1">
                                <button
                                    type="button"
                                    className={cn("rounded px-3 py-1.5 text-sm", form.pickupMethod === "easy" ? "bg-background shadow-sm" : "text-muted-foreground")}
                                    onClick={() => handlePickupMethodChange("easy")}
                                >
                                    Easy method
                                </button>
                                <button
                                    type="button"
                                    className={cn("rounded px-3 py-1.5 text-sm", form.pickupMethod === "advanced" ? "bg-background shadow-sm" : "text-muted-foreground")}
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
                                        type="text"
                                        inputMode="decimal"
                                        value={form.collectionFee}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, collectionFee: toDecimalInput(event.target.value) }))
                                        }
                                    />
                                    {renderFieldError("collectionFee")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="local-transport-easy" className="text-sm font-medium">Transport (RWF)</label>
                                    <Input
                                        id="local-transport-easy"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.localTransport}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, localTransport: toDecimalInput(event.target.value) }))
                                        }
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
                                    <label htmlFor="arrival-notif" className="text-sm font-medium">Arrival Not.</label>
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
                                    <label htmlFor="warehouse-storage" className="text-sm font-medium">Warehouse</label>
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
                                    <label htmlFor="local-transport-advanced" className="text-sm font-medium">Local Transport</label>
                                    <Input
                                        id="local-transport-advanced"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.localTransport}
                                        onChange={(event) =>
                                            setForm((current) => ({ ...current, localTransport: toDecimalInput(event.target.value) }))
                                        }
                                    />
                                    {renderFieldError("localTransport")}
                                </div>
                                <div className="grid gap-1.5">
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
                        )}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {detailItems.length > 0 ? detailItems.map((item) => (
                        <div key={item.label} className="rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="text-sm font-medium">{item.value}</p>
                        </div>
                    )) : (
                        <div className="rounded-md border p-3 text-sm text-muted-foreground md:col-span-2">
                            No expense details above 0.
                        </div>
                    )}
                    <div className="rounded-md border p-3">
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-muted-foreground">Tracking number</p>
                            {form.trackingId ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={copyTrackingNumber}
                                    aria-label="Copy tracking number"
                                >
                                    <CopyIcon className="h-4 w-4" />
                                </Button>
                            ) : null}
                        </div>
                        <p className="mt-2 text-sm font-medium text-foreground">{form.trackingId || "Not set"}</p>
                    </div>
                </div>
            )}

            <div className="space-y-2">
                {isEditing ? (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Select Products</p>
                            {renderProductSelector()}
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium">Selected Products</p>
                            {renderBatchProductsTable()}
                        </div>
                    </div>
                ) : (
                    <>
                        <p className="text-sm font-medium">Products</p>
                        {renderBatchProductsTable()}
                    </>
                )}
            </div>

            {errors.general ? <p className="text-sm text-destructive">{errors.general}</p> : null}
        </form>
    )
}
