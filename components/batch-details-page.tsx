"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AddProductSheet } from "@/components/add-product-sheet"
import { CurrencyAmountRateRow } from "@/components/currency-amount-rate-row"
import { FormattedNumberInput } from "@/components/formatted-number-input"
import { calculateBatchProductLandedCosts, convertInternationalExpenseToRwf } from "@/lib/costs"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"
import { getAllIntendedSellingPrices } from "@/lib/intended-pricing"
import { cn } from "@/lib/utils"
import { CheckIcon, ChevronLeft, CopyIcon, PackageOpen, Printer, SearchIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

const CURRENCY_OPTIONS = ["RWF", "USD", "CNY", "AED"] as const
const PRODUCTS_PER_PAGE = 10
const BATCH_PRODUCT_COLUMN_ORDER_STORAGE_KEY = "batch-details:column-order"

type BatchProductTableColumnKey =
    | "index"
    | "product"
    | "quantity"
    | "purchase"
    | "importCharges"
    | "weight"
    | "sellingPrice"
    | "landedCost"
    | "profit"

const DEFAULT_BATCH_PRODUCT_COLUMN_ORDER: BatchProductTableColumnKey[] = [
    "index",
    "product",
    "quantity",
    "purchase",
    "importCharges",
    "weight",
    "sellingPrice",
    "landedCost",
    "profit",
]

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
    const [hasMounted, setHasMounted] = React.useState(false)
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
    const [columnOrder, setColumnOrder] = React.useState<BatchProductTableColumnKey[]>(DEFAULT_BATCH_PRODUCT_COLUMN_ORDER)
    const [draggedColumn, setDraggedColumn] = React.useState<BatchProductTableColumnKey | null>(null)
    const productSearchInputRef = React.useRef<HTMLInputElement | null>(null)
    const submitIntentRef = React.useRef(false)

    React.useEffect(() => {
        const savedColumnOrderRaw = window.localStorage.getItem(BATCH_PRODUCT_COLUMN_ORDER_STORAGE_KEY)
        if (!savedColumnOrderRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedColumnOrderRaw)
            if (!Array.isArray(parsed)) {
                return
            }

            const validKeys = parsed.filter((key): key is BatchProductTableColumnKey =>
                DEFAULT_BATCH_PRODUCT_COLUMN_ORDER.includes(key as BatchProductTableColumnKey)
            )

            if (validKeys.length === 0) {
                return
            }

            const mergedOrder = [
                ...validKeys,
                ...DEFAULT_BATCH_PRODUCT_COLUMN_ORDER.filter((key) => !validKeys.includes(key)),
            ]

            setColumnOrder(mergedOrder)
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(BATCH_PRODUCT_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
    }, [columnOrder])

    const stripCommas = (value: string) => value.replace(/,/g, "")

    const moveItem = React.useCallback(<T,>(items: T[], fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
            return items
        }

        const next = [...items]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
    }, [])

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

    const handleColumnDrop = React.useCallback((targetColumn: BatchProductTableColumnKey) => {
        if (!draggedColumn || draggedColumn === targetColumn) {
            return
        }

        setColumnOrder((current) => {
            const next = [...current]
            const fromIndex = next.indexOf(draggedColumn)
            const toIndex = next.indexOf(targetColumn)

            if (fromIndex === -1 || toIndex === -1) {
                return current
            }

            return moveItem(next, fromIndex, toIndex)
        })

        setDraggedColumn(null)
    }, [draggedColumn, moveItem])

    const hasAnyExpenseAmount = React.useCallback(
        (nextForm: typeof initialBatchForm) => {
            return expenseFieldKeys.some((key) => Number(stripCommas(nextForm[key]) || 0) > 0)
        },
        []
    )

    const canSave = hasAnyExpenseAmount(form)

    const columnLabels: Record<BatchProductTableColumnKey, string> = {
        index: "#",
        product: "Product",
        quantity: "Quantity",
        purchase: "Purchase",
        importCharges: "Import Charges",
        weight: "Weight %",
        sellingPrice: "Selling Price",
        landedCost: "Landed Cost",
        profit: "Profit",
    }

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
    const intendedSellingPricesByProductId = React.useMemo(() => getAllIntendedSellingPrices(products), [products])

    const availableProducts = React.useMemo(() => {
        return products.filter((product) => {
            const assignedBatchId = product.batchId?._id
            return !assignedBatchId || assignedBatchId === batchId
        })
    }, [products, batchId])

    const filteredProducts = React.useMemo(() => {
        const searchLower = productSearch.toLowerCase().trim()
        if (!searchLower) {
            return availableProducts
        }

        return availableProducts.filter((product) => product.name.toLowerCase().includes(searchLower))
    }, [availableProducts, productSearch])

    const totalProductPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE))

    const paginatedProducts = React.useMemo(() => {
        const start = (productPage - 1) * PRODUCTS_PER_PAGE
        return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE)
    }, [filteredProducts, productPage])

    React.useEffect(() => {
        setHasMounted(true)
    }, [])

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

    const mergeProducts = React.useCallback((baseProducts: Product[], assignedProducts: Product[]) => {
        const mergedMap = new Map<string, Product>()

        for (const product of baseProducts) {
            mergedMap.set(product._id, product)
        }

        for (const product of assignedProducts) {
            mergedMap.set(product._id, product)
        }

        return Array.from(mergedMap.values())
    }, [])

    const fetchAssignedBatchProducts = React.useCallback(async () => {
        const assignedProductsRes = await fetch(`/api/batches/${batchId}/products`)
        if (!assignedProductsRes.ok) {
            return [] as Product[]
        }

        const assignedProductsData = await assignedProductsRes.json()
        return ((assignedProductsData.products ?? []) as Product[])
    }, [batchId])

    const fetchAllProducts = React.useCallback(async () => {
        const pageSize = 200
        let page = 1
        let totalCount = Number.POSITIVE_INFINITY
        const allProducts: Product[] = []

        while (allProducts.length < totalCount) {
            const response = await fetch(`/api/products?page=${page}&limit=${pageSize}`)
            if (!response.ok) {
                break
            }

            const data = await response.json()
            const pageProducts = (data.products ?? []) as Product[]
            totalCount = Number(data.totalCount ?? pageProducts.length)

            allProducts.push(...pageProducts)

            if (pageProducts.length === 0) {
                break
            }

            page += 1
        }

        return allProducts
    }, [])

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

    const refreshProductsOnly = React.useCallback(async () => {
        const [allProducts, assignedProducts] = await Promise.all([
            fetchAllProducts(),
            fetchAssignedBatchProducts(),
        ])

        const mergedProducts = mergeProducts(allProducts, assignedProducts)
        setProducts(mergedProducts)
        return mergedProducts
    }, [fetchAllProducts, fetchAssignedBatchProducts, mergeProducts])

    React.useEffect(() => {
        const load = async () => {
            setIsLoading(true)
            setLoadError("")

            try {
                const [batchesRes, allProducts, assignedProducts] = await Promise.all([
                    fetch("/api/batches"),
                    fetchAllProducts(),
                    fetchAssignedBatchProducts(),
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

                const mergedProducts = mergeProducts(allProducts, assignedProducts)
                setProducts(mergedProducts)

                let nextSelectedProductIds: string[] = []
                if (assignedProducts.length > 0) {
                    nextSelectedProductIds = assignedProducts.map((product) => product._id)
                } else if (mergedProducts.length > 0) {
                    nextSelectedProductIds = mergedProducts
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
    }, [batchId, fetchAllProducts, fetchAssignedBatchProducts, mergeProducts])

    const handleProductCreated = React.useCallback(async () => {
        const nextProducts = await refreshProductsOnly()
        const nextIds = new Set(nextProducts.map((product) => product._id))
        setSelectedProductIds((current) => current.filter((id) => nextIds.has(id)))
    }, [refreshProductsOnly])

    const renderFieldError = (field: string) => {
        if (!errors[field]) {
            return null
        }

        return <p className="text-xs text-destructive">{errors[field]}</p>
    }

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!isEditing || !submitIntentRef.current) {
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
                toast.error(updateErrors?.general ?? "Failed to update batch")
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
                toast.error(syncErrors?.general ?? "Failed to update products")
                return
            }

            setInitialForm(form)
            setInitialSelectedProductIds([...selectedProductIds])
            setIsEditing(false)

            // Refresh products to show updated landed costs
            await refreshProductsOnly()

            toast.success("Batch updated")
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
        if (availableProducts.length === 0) {
            return (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No available products yet.
                </div>
            )
        }

        return (
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div className="relative w-full sm:w-96">
                        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            ref={productSearchInputRef}
                            value={productSearch}
                            onChange={(event) => setProductSearch(event.target.value)}
                            placeholder="Search products"
                            className="h-12 pr-18 pl-9"
                        />
                        {productSearch ? (
                            <button
                                type="button"
                                onClick={() => setProductSearch("")}
                                className="absolute right-1 top-1 bottom-1 flex w-10 items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700"
                                aria-label="Clear search"
                            >
                                <XIcon className="h-4 w-4" />
                            </button>
                        ) : (
                            <KbdGroup className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex">
                                <Kbd>Ctrl</Kbd>
                                <Kbd>F</Kbd>
                            </KbdGroup>
                        )}
                    </div>
                    <AddProductSheet onProductCreated={handleProductCreated} />
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
                            <div
                                key={product._id}
                                role="button"
                                tabIndex={isEditing ? 0 : -1}
                                aria-disabled={!isEditing}
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
                                onKeyDown={(event) => {
                                    if (!isEditing) {
                                        return
                                    }
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
                                    "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0",
                                    index === 0 && "rounded-t-md",
                                    index === paginatedProducts.length - 1 && "rounded-b-md",
                                    isSelected
                                        ? "bg-primary/20 text-foreground hover:bg-primary/20"
                                        : "hover:bg-muted/40",
                                    isEditing ? "cursor-pointer" : "cursor-default"
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
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium" title={product.name}>{product.name}</p>
                                    <p className="text-xs text-muted-foreground">Assigned: {assignedBatchName ?? "Unassigned"}</p>
                                </div>
                            </div>
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

        const totals = selectedProducts.reduce(
            (acc, product) => {
                const preview = allocationPreviewByProductId.get(product._id)
                const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                const baseTotal = baseUnitPrice * product.quantityInitial
                const finalUnit = preview ? preview.landedCost : baseUnitPrice
                const finalTotal = finalUnit * product.quantityInitial
                const shippingShare = Math.max(0, finalTotal - baseTotal)
                const intendedSellingPrice = intendedSellingPricesByProductId[product._id]
                const sellingTotal = typeof intendedSellingPrice === "number"
                    ? intendedSellingPrice * product.quantityInitial
                    : 0
                const profit = typeof intendedSellingPrice === "number"
                    ? sellingTotal - finalTotal
                    : 0

                return {
                    quantity: acc.quantity + product.quantityInitial,
                    baseTotal: acc.baseTotal + baseTotal,
                    weightPercentage: acc.weightPercentage + (preview?.weightPercentage ?? 0),
                    shippingShare: acc.shippingShare + shippingShare,
                    finalTotal: acc.finalTotal + finalTotal,
                    sellingTotal: acc.sellingTotal + sellingTotal,
                    totalProfit: acc.totalProfit + profit,
                }
            },
            { quantity: 0, baseTotal: 0, weightPercentage: 0, shippingShare: 0, finalTotal: 0, sellingTotal: 0, totalProfit: 0 }
        )

        const renderBatchProductCell = (product: Product, rowIndex: number, columnKey: BatchProductTableColumnKey, preview: ReturnType<typeof allocationPreviewByProductId.get>, baseUnitPrice: number, productTotal: number, finalUnit: number, finalTotal: number, importCharges: number, intendedSellingPrice: number | undefined) => {
            if (columnKey === "index") {
                return <TableCell className="text-center text-muted-foreground">{rowIndex + 1}</TableCell>
            }

            if (columnKey === "product") {
                return (
                    <TableCell className="max-w-xs font-medium">
                        <Link
                            href={`/app/products/${product._id}?returnTo=${encodeURIComponent(`/app/batches/${batchId}`)}`}
                            className="block truncate hover:bg-black/3 max-w-full w-max rounded-sm p-2"
                            title={product.name}
                        >
                            {product.name}
                        </Link>
                    </TableCell>
                )
            }

            if (columnKey === "quantity") {
                return <TableCell className="text-right">{product.quantityInitial.toLocaleString()}</TableCell>
            }

            if (columnKey === "purchase") {
                return (
                    <TableCell className="text-right">
                        {product.quantityInitial === 1 ? (
                            <div className="font-medium">{Math.floor(baseUnitPrice).toLocaleString()}</div>
                        ) : (
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Unit: {Math.floor(baseUnitPrice).toLocaleString()}</div>
                                <div className="font-medium">All: {Math.floor(productTotal).toLocaleString()}</div>
                            </div>
                        )}
                    </TableCell>
                )
            }

            if (columnKey === "importCharges") {
                return <TableCell className="text-right">{Math.floor(importCharges).toLocaleString()}</TableCell>
            }

            if (columnKey === "weight") {
                return <TableCell className="text-right">{preview ? `${preview.weightPercentage.toFixed(2)}%` : "-"}</TableCell>
            }

            if (columnKey === "sellingPrice") {
                return (
                    <TableCell className="text-right">
                        {typeof intendedSellingPrice === "number" ? (
                            product.quantityInitial === 1 ? (
                                <div className="font-medium">{Math.floor(intendedSellingPrice).toLocaleString()}</div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Unit: {Math.floor(intendedSellingPrice).toLocaleString()}</div>
                                    <div className="font-medium">All: {Math.floor(intendedSellingPrice * product.quantityInitial).toLocaleString()}</div>
                                </div>
                            )
                        ) : (
                            "-"
                        )}
                    </TableCell>
                )
            }

            if (columnKey === "landedCost") {
                return (
                    <TableCell className="text-right">
                        {product.quantityInitial === 1 ? (
                            <div className="font-medium">{Math.floor(finalUnit).toLocaleString()}</div>
                        ) : (
                            <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Unit: {Math.floor(finalUnit).toLocaleString()}</div>
                                <div className="font-medium">All: {Math.floor(finalTotal).toLocaleString()}</div>
                            </div>
                        )}
                    </TableCell>
                )
            }

            if (columnKey === "profit") {
                return (
                    <TableCell className="text-right">
                        {typeof intendedSellingPrice === "number" ? (
                            product.quantityInitial === 1 ? (
                                <div className="font-medium">{Math.floor(intendedSellingPrice - finalUnit).toLocaleString()}</div>
                            ) : (
                                <div className="space-y-1">
                                    <div className="text-xs text-muted-foreground">Unit: {Math.floor(intendedSellingPrice - finalUnit).toLocaleString()}</div>
                                    <div className="font-medium">All: {Math.floor((intendedSellingPrice * product.quantityInitial) - finalTotal).toLocaleString()}</div>
                                </div>
                            )
                        ) : (
                            "-"
                        )}
                    </TableCell>
                )
            }

            return null
        }

        const renderBatchTotalCell = (columnKey: BatchProductTableColumnKey) => {
            if (columnKey === "index") {
                return <TableCell className="text-center">-</TableCell>
            }

            if (columnKey === "product") {
                return <TableCell>TOTAL</TableCell>
            }

            if (columnKey === "quantity") {
                return <TableCell className="text-right">{totals.quantity.toLocaleString()}</TableCell>
            }

            if (columnKey === "purchase") {
                return <TableCell className="text-right">{Math.floor(totals.baseTotal).toLocaleString()}</TableCell>
            }

            if (columnKey === "importCharges") {
                return <TableCell className="text-right">{Math.floor(totals.shippingShare).toLocaleString()}</TableCell>
            }

            if (columnKey === "weight") {
                return <TableCell className="text-right">100%</TableCell>
            }

            if (columnKey === "sellingPrice") {
                return <TableCell className="text-right">{totals.sellingTotal > 0 ? Math.floor(totals.sellingTotal).toLocaleString() : "-"}</TableCell>
            }

            if (columnKey === "landedCost") {
                return <TableCell className="text-right">{Math.floor(totals.finalTotal).toLocaleString()}</TableCell>
            }

            if (columnKey === "profit") {
                return <TableCell className="text-right">{totals.totalProfit > 0 ? Math.floor(totals.totalProfit).toLocaleString() : "-"}</TableCell>
            }

            return null
        }

        return (
            <div className="overflow-hidden rounded-md border print:overflow-visible print:rounded-none print:border-0">
                <div className="overflow-x-auto print:overflow-visible">
                    <Table className="min-w-275 print:min-w-0 print:w-full print:text-[11px]">
                        <TableHeader className="sticky top-0 bg-background z-10 print:sticky-none">
                            <TableRow>
                                {columnOrder.map((columnKey) => (
                                    <TableHead
                                        key={columnKey}
                                        draggable
                                        onDragStart={() => setDraggedColumn(columnKey)}
                                        onDragEnd={() => setDraggedColumn(null)}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => handleColumnDrop(columnKey)}
                                        className={cn(
                                            "cursor-move select-none text-right",
                                            columnKey === "product" && "w-12 text-left",
                                            columnKey === "index" && "w-12 text-center opacity-40"
                                        )}
                                        title="Drag to reorder columns"
                                    >
                                        <span>{columnLabels[columnKey]}</span>
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {selectedProducts.map((product, index) => {
                                const preview = allocationPreviewByProductId.get(product._id)
                                const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                const productTotal = baseUnitPrice * product.quantityInitial
                                const finalUnit = preview ? preview.landedCost : baseUnitPrice
                                const finalTotal = finalUnit * product.quantityInitial
                                const importCharges = Math.max(0, finalTotal - productTotal)
                                const intendedSellingPrice = intendedSellingPricesByProductId[product._id]

                                return (
                                    <TableRow key={product._id}>
                                        {columnOrder.map((columnKey) => (
                                            <React.Fragment key={`${product._id}-${columnKey}`}>
                                                {renderBatchProductCell(product, index, columnKey, preview, baseUnitPrice, productTotal, finalUnit, finalTotal, importCharges, intendedSellingPrice)}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>
                                )
                            })}
                            <TableRow className="bg-muted/30 font-semibold">
                                {columnOrder.map((columnKey) => (
                                    <React.Fragment key={`total-${columnKey}`}>
                                        {renderBatchTotalCell(columnKey)}
                                    </React.Fragment>
                                ))}
                            </TableRow>
                        </TableBody>
                    </Table>
                </div>
            </div>
        )
    }

    const renderProductsTableSkeleton = () => (
        <div className="overflow-hidden rounded-md border print:overflow-visible print:rounded-none print:border-0">
            <div className="overflow-x-auto">
                <Table className="min-w-275 print:min-w-0 print:w-full print:text-[11px]">
                    <TableHeader className="sticky top-0 bg-background z-10 print:sticky-none">
                        <TableRow>
                            <TableHead className="w-12 text-center">#</TableHead>
                            <TableHead>Product</TableHead>
                            <TableHead className="text-end">Quantity</TableHead>
                            <TableHead className="text-right">Purchase</TableHead>
                            <TableHead className="text-right">Import Charges</TableHead>
                            <TableHead className="text-right">Weight %</TableHead>
                            <TableHead className="text-right">Selling Price</TableHead>
                            <TableHead className="text-right">Landed Cost</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {[0, 1, 2, 3].map((index) => (
                            <TableRow key={`batch-details-loading-${index}`}>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-6" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-14" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-20" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-20" /></TableCell>
                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )

    if (!hasMounted || isLoading) {
        return (
            <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
                <div className="mb-1 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-md" />
                    <Skeleton className="h-4 w-28" />
                </div>
                <CardHeader className="flex items-center justify-between gap-3 px-0">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-44" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                    <Skeleton className="h-10 w-28 rounded-md" />
                </CardHeader>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4 lg:grid-cols-5">
                    {[0, 1, 2].map((index) => (
                        <div key={`batch-card-loading-${index}`} className="rounded-md border p-3">
                            <Skeleton className="h-3 w-24" />
                            <Skeleton className="mt-3 h-8 w-32" />
                            <Skeleton className="mt-2 h-3 w-36" />
                        </div>
                    ))}
                </div>
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    {renderProductsTableSkeleton()}
                </div>
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
            estimateRwf: convertInternationalExpenseToRwf(
                Number(stripCommas(form.intlShipping) || 0),
                form.intlShippingCurrency,
                Number(stripCommas(form.intlShippingExchangeRate) || 1)
            ),
        },
        {
            label: "Warehouse USA",
            amount: Number(stripCommas(form.warehouseUSA) || 0),
            value: formatIntlDisplay(form.warehouseUSA, form.warehouseUSACurrency, form.warehouseUSAExchangeRate),
            estimateRwf: convertInternationalExpenseToRwf(
                Number(stripCommas(form.warehouseUSA) || 0),
                form.warehouseUSACurrency,
                Number(stripCommas(form.warehouseUSAExchangeRate) || 1)
            ),
        },
        {
            label: "Amazon Prime",
            amount: Number(stripCommas(form.amazonPrime) || 0),
            value: formatIntlDisplay(form.amazonPrime, form.amazonPrimeCurrency, form.amazonPrimeExchangeRate),
            estimateRwf: convertInternationalExpenseToRwf(
                Number(stripCommas(form.amazonPrime) || 0),
                form.amazonPrimeCurrency,
                Number(stripCommas(form.amazonPrimeExchangeRate) || 1)
            ),
        },
        {
            label: "Collection fee",
            amount: Number(stripCommas(form.collectionFee) || 0),
            value: Number(stripCommas(form.collectionFee) || 0).toLocaleString(),
        },
        {
            label: "Customs duties",
            amount: Number(stripCommas(form.customsDuties) || 0),
            value: Number(stripCommas(form.customsDuties) || 0).toLocaleString(),
        },
        {
            label: "Declaration",
            amount: Number(stripCommas(form.declaration) || 0),
            value: Number(stripCommas(form.declaration) || 0).toLocaleString(),
        },
        {
            label: "Arrival notification",
            amount: Number(stripCommas(form.arrivalNotif) || 0),
            value: Number(stripCommas(form.arrivalNotif) || 0).toLocaleString(),
        },
        {
            label: "Warehouse storage",
            amount: Number(stripCommas(form.warehouseStorage) || 0),
            value: Number(stripCommas(form.warehouseStorage) || 0).toLocaleString(),
        },
        {
            label: "Local transport",
            amount: Number(stripCommas(form.localTransport) || 0),
            value: Number(stripCommas(form.localTransport) || 0).toLocaleString(),
        },
        {
            label: "Miscellaneous",
            amount: Number(stripCommas(form.miscellaneous) || 0),
            value: Number(stripCommas(form.miscellaneous) || 0).toLocaleString(),
        },
    ].filter((item) => item.amount > 0)

    return (
        <form className="flex flex-1 flex-col gap-4 p-4 lg:p-6 print:p-0" onSubmit={submit} onKeyDown={preventImplicitSubmitOnEnter}>
            <div className="mb-1 flex items-center gap-3 print:hidden">
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
                                className="h-7 w-7 print:hidden"
                                onClick={copyTrackingNumber}
                                aria-label="Copy tracking number"
                            >
                                <CopyIcon className="h-4 w-4" />
                            </Button>
                        ) : null}
                    </div>
                </div>
                {isEditing ? (
                    <div className="flex items-center gap-2 print:hidden">
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
                            onClick={() => {
                                submitIntentRef.current = true
                            }}
                        >
                            {isSubmitting ? "Saving..." : "Save"}
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 print:hidden">
                        <Button
                            type="button"
                            size={"lg"}
                            variant="outline"
                            className="h-10 border-input bg-white px-6 text-foreground hover:bg-muted"
                            onClick={() => window.print()}
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <Button type="button" size={"lg"} className="h-10 px-6" onClick={() => setIsEditing(true)}>
                            Edit
                        </Button>
                    </div>
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

                        <div className="grid gap-4 xl:grid-cols-3">
                            <CurrencyAmountRateRow
                                amountId="intl-shipping"
                                amountLabel="Intl shipping"
                                amountValue={form.intlShipping}
                                onAmountChange={(value) => setForm((current) => ({ ...current, intlShipping: value }))}
                                amountError={errors.intlShipping}
                                currencyValue={form.intlShippingCurrency}
                                onCurrencyChange={(value) =>
                                    setForm((current) => ({
                                        ...current,
                                        intlShippingCurrency: value,
                                        intlShippingExchangeRate: value === "RWF" ? "1" : current.intlShippingExchangeRate,
                                    }))
                                }
                                currencyOptions={CURRENCY_OPTIONS}
                                rateValue={form.intlShippingExchangeRate}
                                onRateChange={(value) => setForm((current) => ({ ...current, intlShippingExchangeRate: value }))}
                                ratePlaceholder="Rate to RWF"
                                rateError={errors.intlShippingExchangeRate}
                                disabledRate={form.intlShippingCurrency === "RWF"}
                            />
                            <CurrencyAmountRateRow
                                amountId="warehouse-usa"
                                amountLabel="Warehouse USA"
                                amountValue={form.warehouseUSA}
                                onAmountChange={(value) => setForm((current) => ({ ...current, warehouseUSA: value }))}
                                amountError={errors.warehouseUSA}
                                currencyValue={form.warehouseUSACurrency}
                                onCurrencyChange={(value) =>
                                    setForm((current) => ({
                                        ...current,
                                        warehouseUSACurrency: value,
                                        warehouseUSAExchangeRate: value === "RWF" ? "1" : current.warehouseUSAExchangeRate,
                                    }))
                                }
                                currencyOptions={CURRENCY_OPTIONS}
                                rateValue={form.warehouseUSAExchangeRate}
                                onRateChange={(value) => setForm((current) => ({ ...current, warehouseUSAExchangeRate: value }))}
                                ratePlaceholder="Rate to RWF"
                                rateError={errors.warehouseUSAExchangeRate}
                                disabledRate={form.warehouseUSACurrency === "RWF"}
                            />
                            <CurrencyAmountRateRow
                                amountId="amazon-prime"
                                amountLabel="Amazon Prime"
                                amountValue={form.amazonPrime}
                                onAmountChange={(value) => setForm((current) => ({ ...current, amazonPrime: value }))}
                                amountError={errors.amazonPrime}
                                currencyValue={form.amazonPrimeCurrency}
                                onCurrencyChange={(value) =>
                                    setForm((current) => ({
                                        ...current,
                                        amazonPrimeCurrency: value,
                                        amazonPrimeExchangeRate: value === "RWF" ? "1" : current.amazonPrimeExchangeRate,
                                    }))
                                }
                                currencyOptions={CURRENCY_OPTIONS}
                                rateValue={form.amazonPrimeExchangeRate}
                                onRateChange={(value) => setForm((current) => ({ ...current, amazonPrimeExchangeRate: value }))}
                                ratePlaceholder="Rate to RWF"
                                rateError={errors.amazonPrimeExchangeRate}
                                disabledRate={form.amazonPrimeCurrency === "RWF"}
                            />
                        </div>
                    </div>

                    <div className="space-y-3 rounded-lg border p-3">
                        <p className="text-sm font-semibold">Local Expenses</p>
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
                                    <label htmlFor="collection-fee" className="text-sm font-medium">Collection Fee</label>
                                    <FormattedNumberInput
                                        id="collection-fee"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.collectionFee}
                                        onValueChange={(value) => setForm((current) => ({ ...current, collectionFee: value }))}
                                    />
                                    {renderFieldError("collectionFee")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="local-transport-easy" className="text-sm font-medium">Transport</label>
                                    <FormattedNumberInput
                                        id="local-transport-easy"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.localTransport}
                                        onValueChange={(value) => setForm((current) => ({ ...current, localTransport: value }))}
                                    />
                                    {renderFieldError("localTransport")}
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <label htmlFor="customs-duties" className="text-sm font-medium">Custom Duties (Tax)</label>
                                    <FormattedNumberInput
                                        id="customs-duties"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.customsDuties}
                                        onValueChange={(value) => setForm((current) => ({ ...current, customsDuties: value }))}
                                    />
                                    {renderFieldError("customsDuties")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="arrival-notif" className="text-sm font-medium">Arrival Not.</label>
                                    <FormattedNumberInput
                                        id="arrival-notif"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.arrivalNotif}
                                        onValueChange={(value) => setForm((current) => ({ ...current, arrivalNotif: value }))}
                                    />
                                    {renderFieldError("arrivalNotif")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="warehouse-storage" className="text-sm font-medium">Warehouse</label>
                                    <FormattedNumberInput
                                        id="warehouse-storage"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.warehouseStorage}
                                        onValueChange={(value) => setForm((current) => ({ ...current, warehouseStorage: value }))}
                                    />
                                    {renderFieldError("warehouseStorage")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="declaration" className="text-sm font-medium">Declaration</label>
                                    <FormattedNumberInput
                                        id="declaration"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.declaration}
                                        onValueChange={(value) => setForm((current) => ({ ...current, declaration: value }))}
                                    />
                                    {renderFieldError("declaration")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="local-transport-advanced" className="text-sm font-medium">Local Transport</label>
                                    <FormattedNumberInput
                                        id="local-transport-advanced"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.localTransport}
                                        onValueChange={(value) => setForm((current) => ({ ...current, localTransport: value }))}
                                    />
                                    {renderFieldError("localTransport")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="miscellaneous" className="text-sm font-medium">Miscellaneous</label>
                                    <FormattedNumberInput
                                        id="miscellaneous"
                                        type="text"
                                        inputMode="decimal"
                                        value={form.miscellaneous}
                                        onValueChange={(value) => setForm((current) => ({ ...current, miscellaneous: value }))}
                                    />
                                    {renderFieldError("miscellaneous")}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <div className="w-max rounded-md border p-3">
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
                        <div className="w-max rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Purchase total</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                                {Math.floor(
                                    selectedProducts.reduce((sum, product) => {
                                        const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                        return sum + (baseUnitPrice * product.quantityInitial)
                                    }, 0)
                                ).toLocaleString()} RWF
                            </p>
                        </div>
                        <div className="w-max rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Total Import Charges</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                                {Math.floor(selectedProducts
                                    .reduce((sum, product) => {
                                        const preview = allocationPreviewByProductId.get(product._id)
                                        const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                        const baseTotal = baseUnitPrice * product.quantityInitial
                                        const finalUnit = preview ? preview.landedCost : baseUnitPrice
                                        const finalTotal = finalUnit * product.quantityInitial
                                        return sum + Math.max(0, finalTotal - baseTotal)
                                    }, 0))
                                    .toLocaleString()} RWF
                            </p>
                        </div>
                        <div className="w-max rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Landed (All)</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                                {Math.floor(
                                    selectedProducts.reduce((sum, product) => {
                                        const preview = allocationPreviewByProductId.get(product._id)
                                        const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                        const finalUnit = preview ? preview.landedCost : baseUnitPrice
                                        return sum + (finalUnit * product.quantityInitial)
                                    }, 0)
                                ).toLocaleString()} RWF
                            </p>
                        </div>
                        <div className="w-max rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">Selling (All)</p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                                {Math.floor(
                                    selectedProducts.reduce((sum, product) => {
                                        const intendedSellingPrice = intendedSellingPricesByProductId[product._id]
                                        if (typeof intendedSellingPrice !== "number") {
                                            return sum
                                        }

                                        return sum + (intendedSellingPrice * product.quantityInitial)
                                    }, 0)
                                ).toLocaleString()} RWF
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap gap-3">
                    {detailItems.length > 0 ? detailItems.map((item) => (
                        <div key={item.label} className="w-max rounded-md border p-3">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            {typeof item.estimateRwf === "number" && item.estimateRwf > 0 ? (
                                <>
                                    <p className="mt-2 text-sm font-medium text-foreground">
                                        ≈{Math.floor(item.estimateRwf).toLocaleString()} RWF
                                    </p>
                                    <p className="mt-1 text-xs font-semibold text-muted-foreground">{item.value}</p>
                                </>
                            ) : (
                                <p className="text-sm font-medium">{item.value} RWF</p>
                            )}
                        </div>
                    )) : (
                        <div className="w-max rounded-md border p-3 text-sm text-muted-foreground">
                            No expense details above 0.
                        </div>
                    )}
                    <div className="w-max rounded-md border p-3">
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
                    <div className="w-max rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Purchase total</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                            {Math.floor(
                                selectedProducts.reduce((sum, product) => {
                                    const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                    return sum + (baseUnitPrice * product.quantityInitial)
                                }, 0)
                            ).toLocaleString()} RWF
                        </p>
                    </div>
                    <div className="w-max rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Total Import Charges</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                            {Math.floor(
                                selectedProducts.reduce((sum, product) => {
                                    const preview = allocationPreviewByProductId.get(product._id)
                                    const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                    const baseTotal = baseUnitPrice * product.quantityInitial
                                    const finalUnit = preview ? preview.landedCost : baseUnitPrice
                                    const finalTotal = finalUnit * product.quantityInitial
                                    return sum + Math.max(0, finalTotal - baseTotal)
                                }, 0)
                            ).toLocaleString()} RWF
                        </p>
                    </div>
                    <div className="w-max rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Landed Total</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                            {Math.floor(
                                selectedProducts.reduce((sum, product) => {
                                    const preview = allocationPreviewByProductId.get(product._id)
                                    const baseUnitPrice = product.unitPriceLocalRWF ?? product.purchasePriceRWF
                                    const finalUnit = preview ? preview.landedCost : baseUnitPrice
                                    return sum + (finalUnit * product.quantityInitial)
                                }, 0)
                            ).toLocaleString()} RWF
                        </p>
                    </div>
                    <div className="w-max rounded-md border p-3">
                        <p className="text-xs text-muted-foreground">Selling total</p>
                        <p className="mt-2 text-sm font-medium text-foreground">
                            {Math.floor(
                                selectedProducts.reduce((sum, product) => {
                                    const intendedSellingPrice = intendedSellingPricesByProductId[product._id]
                                    if (typeof intendedSellingPrice !== "number") {
                                        return sum
                                    }

                                    return sum + (intendedSellingPrice * product.quantityInitial)
                                }, 0)
                            ).toLocaleString()} RWF
                        </p>
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
