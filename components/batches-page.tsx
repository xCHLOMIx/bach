"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { convertInternationalExpenseToRwf } from "@/lib/costs"
import { cn } from "@/lib/utils"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { CheckIcon, CopyIcon, PackageSearchIcon, SearchIcon, ChevronUpIcon, ChevronDownIcon, Trash2Icon, Columns3Icon } from "lucide-react"

const CURRENCY_OPTIONS = ["RWF", "USD", "CNY", "EUR"] as const
const BATCHES_VISIBLE_COLUMNS_STORAGE_KEY = "batches:visible-columns"
type PickupMethod = "easy" | "advanced"

type Batch = {
    _id: string
    batchName: string
    trackingId?: string
    pickupMethod?: PickupMethod
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
}

type Product = { _id: string; name: string; batchId?: { _id?: string } | null }

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

export function BatchesPage() {
    const router = useRouter()

    const [batches, setBatches] = React.useState<Batch[]>([])
    const [products, setProducts] = React.useState<Product[]>([])
    const [isLoading, setIsLoading] = React.useState(true)

    const [isAddSheetOpen, setIsAddSheetOpen] = React.useState(false)
    const [addForm, setAddForm] = React.useState(initialBatchForm)
    const [addSelectedProductIds, setAddSelectedProductIds] = React.useState<string[]>([])
    const [addErrors, setAddErrors] = React.useState<Record<string, string>>({})
    const [isAddSubmitting, setIsAddSubmitting] = React.useState(false)

    const [batchSearch, setBatchSearch] = React.useState("")
    const [selectedBatchIds, setSelectedBatchIds] = React.useState<Set<string>>(new Set())
    const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
    const [isBulkDeleteInfoLoading, setIsBulkDeleteInfoLoading] = React.useState(false)
    const [bulkDeleteError, setBulkDeleteError] = React.useState("")
    const [bulkDeleteWarningSummary, setBulkDeleteWarningSummary] = React.useState({
        totalProducts: 0,
        batchesWithSales: 0,
        totalSalesRecords: 0,
    })
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
    const [deleteConfirmData, setDeleteConfirmData] = React.useState<{ batchId: string; batchName: string; productCount: number; hasActiveSales: boolean; salesCount: number } | null>(null)
    const [isDeleteInfoLoading, setIsDeleteInfoLoading] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [sortColumn, setSortColumn] = React.useState<"name" | "tracking" | "costs" | "products" | "created">("created")
    const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc")
    const [visibleColumns, setVisibleColumns] = React.useState({ name: true, tracking: true, costs: true, products: true, created: true, actions: true })

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

    const hasAnyExpenseAmount = React.useCallback(
        (form: typeof initialBatchForm) => {
            const internationalTotal =
                Number(stripCommas(form.intlShipping) || 0) +
                Number(stripCommas(form.warehouseUSA) || 0) +
                Number(stripCommas(form.amazonPrime) || 0)

            if (form.pickupMethod === "easy") {
                return (
                    internationalTotal +
                    Number(stripCommas(form.collectionFee) || 0) +
                    Number(stripCommas(form.localTransport) || 0)
                ) > 0
            }

            return (
                internationalTotal +
                expenseFieldKeys
                    .filter((key) => key !== "collectionFee")
                    .reduce((sum, key) => sum + Number(stripCommas(form[key]) || 0), 0)
            ) > 0
        },
        []
    )

    const unassignedProducts = React.useMemo(() => {
        return products.filter((product) => !product.batchId?._id)
    }, [products])

    const getBatchTotalCosts = React.useCallback((batch: Batch) => {
        const intlShippingRwf = convertInternationalExpenseToRwf(
            Number(batch.intlShipping ?? 0),
            batch.intlShippingCurrency ?? "RWF",
            Number(batch.intlShippingExchangeRate ?? 1)
        )

        const warehouseUSARwf = convertInternationalExpenseToRwf(
            Number(batch.warehouseUSA ?? 0),
            batch.warehouseUSACurrency ?? "RWF",
            Number(batch.warehouseUSAExchangeRate ?? 1)
        )

        const amazonPrimeRwf = convertInternationalExpenseToRwf(
            Number(batch.amazonPrime ?? 0),
            batch.amazonPrimeCurrency ?? "RWF",
            Number(batch.amazonPrimeExchangeRate ?? 1)
        )

        return (
            intlShippingRwf +
            Number(batch.taxValue ?? 0) +
            Number(batch.collectionFee ?? 0) +
            Number(batch.customsDuties ?? 0) +
            Number(batch.declaration ?? 0) +
            Number(batch.arrivalNotif ?? 0) +
            Number(batch.warehouseStorage ?? 0) +
            Number(batch.localTransport ?? 0) +
            amazonPrimeRwf +
            warehouseUSARwf +
            Number(batch.miscellaneous ?? 0)
        )
    }, [])

    const filteredBatches = React.useMemo(() => {
        const searchLower = batchSearch.toLowerCase().trim()
        return batches.filter((batch) =>
            batch.batchName.toLowerCase().includes(searchLower) ||
            (batch.trackingId || "").toLowerCase().includes(searchLower)
        )
    }, [batches, batchSearch])

    const sortedBatches = React.useMemo(() => {
        const sorted = [...filteredBatches]
        const stringCollator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

        sorted.sort((a, b) => {
            let aVal: number | string = ""
            let bVal: number | string = ""

            if (sortColumn === "name") {
                aVal = a.batchName
                bVal = b.batchName
            } else if (sortColumn === "tracking") {
                aVal = a.trackingId || ""
                bVal = b.trackingId || ""
            } else if (sortColumn === "costs") {
                aVal = getBatchTotalCosts(a)
                bVal = getBatchTotalCosts(b)
            } else if (sortColumn === "products") {
                aVal = a.productCount ?? 0
                bVal = b.productCount ?? 0
            } else {
                aVal = new Date(a.createdAt).getTime()
                bVal = new Date(b.createdAt).getTime()
            }

            let result = 0
            if (typeof aVal === "number" && typeof bVal === "number") {
                result = aVal - bVal
            } else {
                result = stringCollator.compare(String(aVal), String(bVal))
            }

            return sortDirection === "asc" ? result : -result
        })

        return sorted
    }, [filteredBatches, sortColumn, sortDirection, getBatchTotalCosts])

    const isAllBatchesSelected = sortedBatches.length > 0 && selectedBatchIds.size === sortedBatches.length

    const handleDeleteBatch = async (batch: Batch) => {
        setDeleteConfirmData({
            batchId: batch._id,
            batchName: batch.batchName,
            productCount: 0,
            hasActiveSales: false,
            salesCount: 0,
        })
        setShowDeleteConfirm(true)
        setIsDeleteInfoLoading(true)

        try {
            const response = await fetch(`/api/batches/${batch._id}`, {
                method: "DELETE",
            })

            const data = await response.json()
            if (!response.ok) {
                alert("Failed to get deletion info")
                return
            }

            setDeleteConfirmData((current) => {
                if (!current || current.batchId !== batch._id) {
                    return current
                }

                return {
                    batchId: batch._id,
                    ...data.deletionInfo,
                }
            })
        } catch (error) {
            alert("Failed to get deletion info")
            console.error(error)
        } finally {
            setIsDeleteInfoLoading(false)
        }
    }

    const confirmDeleteBatch = async () => {
        if (!deleteConfirmData || isDeleteInfoLoading) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/batches/${deleteConfirmData.batchId}?confirm=true`, {
                method: "DELETE",
            })

            if (!response.ok) {
                alert("Failed to delete batch")
                return
            }

            setShowDeleteConfirm(false)
            setDeleteConfirmData(null)
            setIsDeleteInfoLoading(false)
            setSelectedBatchIds((current) => {
                const next = new Set(current)
                next.delete(deleteConfirmData.batchId)
                return next
            })
            await load()
        } catch (error) {
            alert("Failed to delete batch")
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    const removeSelectedBatches = async () => {
        if (selectedBatchIds.size === 0 || isBulkDeleteInfoLoading) return

        setIsBulkDeleting(true)
        try {
            const failedBatchIds: string[] = []

            for (const batchId of selectedBatchIds) {
                const response = await fetch(`/api/batches/${batchId}?confirm=true`, {
                    method: "DELETE",
                })

                if (!response.ok) {
                    failedBatchIds.push(batchId)
                }
            }

            if (failedBatchIds.length > 0) {
                alert(`Failed to delete ${failedBatchIds.length} batches`)
                return
            }

            setSelectedBatchIds(new Set())
            setShowBulkDeleteConfirm(false)
            await load()
        } finally {
            setIsBulkDeleting(false)
        }
    }

    const openBulkDeleteBatchesConfirm = React.useCallback(() => {
        if (selectedBatchIds.size === 0) {
            return
        }

        const selectedBatches = sortedBatches.filter((batch) => selectedBatchIds.has(batch._id))

        setBulkDeleteError("")
        setShowBulkDeleteConfirm(true)
        setIsBulkDeleteInfoLoading(true)
        setBulkDeleteWarningSummary({ totalProducts: 0, batchesWithSales: 0, totalSalesRecords: 0 })

        void (async () => {
            try {
                const responses = await Promise.all(
                    selectedBatches.map((batch) =>
                        fetch(`/api/batches/${batch._id}`, {
                            method: "DELETE",
                        })
                    )
                )

                let totalProducts = 0
                let batchesWithSales = 0
                let totalSalesRecords = 0

                for (const response of responses) {
                    const data = await response.json().catch(() => null)
                    if (!response.ok || !data?.deletionInfo) {
                        continue
                    }

                    const info = data.deletionInfo
                    totalProducts += Number(info.productCount ?? 0)
                    totalSalesRecords += Number(info.salesCount ?? 0)
                    if (info.hasActiveSales) {
                        batchesWithSales += 1
                    }
                }

                setBulkDeleteWarningSummary({
                    totalProducts,
                    batchesWithSales,
                    totalSalesRecords,
                })
            } catch {
                setBulkDeleteError("Failed to load bulk delete warnings")
            } finally {
                setIsBulkDeleteInfoLoading(false)
            }
        })()
    }, [selectedBatchIds, sortedBatches])

    const handleColumnVisibilityChange = (columnKey: string, value: boolean) => {
        setVisibleColumns((current) => ({ ...current, [columnKey]: value }))
    }

    const copyTrackingId = React.useCallback(async (trackingId: string) => {
        if (!trackingId.trim()) {
            return
        }

        await navigator.clipboard.writeText(trackingId.trim())
    }, [])

    const hasSelectedProducts = addSelectedProductIds.length > 0
    const canCreateBatch = hasAnyExpenseAmount(addForm) && hasSelectedProducts

    const renderFieldError = (errors: Record<string, string>, field: string) => {
        if (!errors[field]) {
            return null
        }

        return <p className="text-xs text-destructive">{errors[field]}</p>
    }

    const load = React.useCallback(async () => {
        setIsLoading(true)
        try {
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
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        load()
    }, [load])

    React.useEffect(() => {
        const savedVisibleColumnsRaw = window.localStorage.getItem(BATCHES_VISIBLE_COLUMNS_STORAGE_KEY)
        if (!savedVisibleColumnsRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedVisibleColumnsRaw) as Partial<typeof visibleColumns>
            setVisibleColumns((current) => ({
                ...current,
                name: typeof parsed.name === "boolean" ? parsed.name : current.name,
                tracking: typeof parsed.tracking === "boolean" ? parsed.tracking : current.tracking,
                costs: typeof parsed.costs === "boolean" ? parsed.costs : current.costs,
                products: typeof parsed.products === "boolean" ? parsed.products : current.products,
                created: typeof parsed.created === "boolean" ? parsed.created : current.created,
                actions: typeof parsed.actions === "boolean" ? parsed.actions : current.actions,
            }))
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(BATCHES_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
    }, [visibleColumns])

    const handleAddPickupMethodChange = (method: PickupMethod) => {
        setAddForm((current) => {
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

    const submitAddBatch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsAddSubmitting(true)
        setAddErrors({})

        try {
            if (!hasAnyExpenseAmount(addForm)) {
                setAddErrors({ general: "Add at least one expense amount" })
                return
            }

            if (addSelectedProductIds.length === 0) {
                setAddErrors({ general: "Select at least one product" })
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

            const intlShippingAmount = toAmount(addForm.intlShipping)
            const warehouseUSAAmount = toAmount(addForm.warehouseUSA)
            const amazonPrimeAmount = toAmount(addForm.amazonPrime)

            convertToRwf(
                intlShippingAmount,
                addForm.intlShippingCurrency,
                addForm.intlShippingExchangeRate,
                "intlShipping"
            )
            convertToRwf(
                warehouseUSAAmount,
                addForm.warehouseUSACurrency,
                addForm.warehouseUSAExchangeRate,
                "warehouseUSA"
            )
            convertToRwf(
                amazonPrimeAmount,
                addForm.amazonPrimeCurrency,
                addForm.amazonPrimeExchangeRate,
                "amazonPrime"
            )

            const easyCollectionFee = toAmount(addForm.collectionFee)
            const easyTransport = toAmount(addForm.localTransport)

            const advancedCustomsDuties = toAmount(addForm.customsDuties)
            const advancedArrivalNotif = toAmount(addForm.arrivalNotif)
            const advancedWarehouseStorage = toAmount(addForm.warehouseStorage)
            const advancedDeclaration = toAmount(addForm.declaration)
            const advancedLocalTransport = toAmount(addForm.localTransport)
            const advancedMiscellaneous = toAmount(addForm.miscellaneous)

            const localNumbers = addForm.pickupMethod === "easy"
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
                setAddErrors(nextErrors)
                return
            }

            const requestPayload = {
                batchName: addForm.batchName.trim(),
                trackingId: addForm.trackingId.trim(),
                pickupMethod: addForm.pickupMethod,
                intlShipping: intlShippingAmount,
                intlShippingCurrency: addForm.intlShippingCurrency,
                intlShippingExchangeRate: addForm.intlShippingCurrency === "RWF"
                    ? 1
                    : Number(stripCommas(addForm.intlShippingExchangeRate) || 1),
                warehouseUSA: warehouseUSAAmount,
                warehouseUSACurrency: addForm.warehouseUSACurrency,
                warehouseUSAExchangeRate: addForm.warehouseUSACurrency === "RWF"
                    ? 1
                    : Number(stripCommas(addForm.warehouseUSAExchangeRate) || 1),
                amazonPrime: amazonPrimeAmount,
                amazonPrimeCurrency: addForm.amazonPrimeCurrency,
                amazonPrimeExchangeRate: addForm.amazonPrimeCurrency === "RWF"
                    ? 1
                    : Number(stripCommas(addForm.amazonPrimeExchangeRate) || 1),
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
                setAddErrors(apiErrors ?? { general: "Failed to create batch" })
                return
            }

            const createdBatchId = (data?.batch as { _id?: string } | undefined)?._id
            if (createdBatchId) {
                const syncResponse = await fetch(`/api/batches/${createdBatchId}/products`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productIds: addSelectedProductIds }),
                })

                if (!syncResponse.ok) {
                    const syncData = await safeReadJson(syncResponse)
                    const syncErrors = (syncData?.errors ?? null) as Record<string, string> | null
                    setAddErrors(syncErrors ?? { general: "Batch created, but product assignment failed" })
                    return
                }
            }

            setAddForm(initialBatchForm)
            setAddSelectedProductIds([])
            setIsAddSheetOpen(false)
            await load()
        } finally {
            setIsAddSubmitting(false)
        }
    }

    const renderProductSelector = (
        selectedProductIds: string[],
        setSelectedProductIds: React.Dispatch<React.SetStateAction<string[]>>
    ) => {
        if (unassignedProducts.length === 0) {
            return (
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                    No unassigned products available yet.
                </div>
            )
        }

        return (
            <div className="overflow-hidden rounded-md border">
                {unassignedProducts.map((product, index) => {
                    const isSelected = selectedProductIds.includes(product._id)

                    return (
                        <button
                            key={product._id}
                            type="button"
                            onClick={() => {
                                setSelectedProductIds((current) =>
                                    current.includes(product._id)
                                        ? current.filter((id) => id !== product._id)
                                        : [...current, product._id]
                                )
                            }}
                            className={cn(
                                "flex w-full items-center gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0",
                                index === 0 && "rounded-t-md",
                                index === unassignedProducts.length - 1 && "rounded-b-md",
                                isSelected
                                    ? "bg-primary/20 text-foreground"
                                    : "hover:bg-muted/40"
                            )}
                        >
                            <span className="truncate">{product.name}</span>
                            {isSelected ? <CheckIcon className="ml-auto h-4 w-4" /> : null}
                        </button>
                    )
                })}
            </div>
        )
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="flex items-center justify-between gap-3 px-0">
                <div className="min-w-0">
                    <CardTitle className="text-2xl font-bold">Batches</CardTitle>
                    <CardDescription>Create, edit, and manage products in each batch.</CardDescription>
                </div>
                <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                    <SheetTrigger asChild>
                        <Button className="h-10 px-6" size={"lg"}>
                            Add Batch
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        className="p-0"
                        overlayClassName="bg-black/20 supports-backdrop-filter:backdrop-blur-md"
                    >
                        <div className="flex h-full flex-col">
                            <SheetHeader className="border-b">
                                <SheetTitle>Add Batch</SheetTitle>
                                <SheetDescription>Enter batch details and select products.</SheetDescription>
                            </SheetHeader>
                            <form className="grid flex-1 gap-3 overflow-y-auto p-4" onSubmit={submitAddBatch}>
                                <div className="grid gap-1.5">
                                    <label htmlFor="add-batch-name" className="text-sm font-medium">Batch name</label>
                                    <Input
                                        id="add-batch-name"
                                        placeholder="Batch name"
                                        value={addForm.batchName}
                                        onChange={(event) =>
                                            setAddForm((current) => ({ ...current, batchName: event.target.value }))
                                        }
                                    />
                                    {renderFieldError(addErrors, "batchName")}
                                </div>
                                <div className="grid gap-1.5">
                                    <label htmlFor="add-tracking-id" className="text-sm font-medium">Tracking number</label>
                                    <Input
                                        id="add-tracking-id"
                                        placeholder="Optional tracking number"
                                        value={addForm.trackingId}
                                        onChange={(event) =>
                                            setAddForm((current) => ({ ...current, trackingId: event.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-3 rounded-lg border p-3">
                                    <p className="text-sm font-semibold">International Expenses</p>
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="grid gap-1.5">
                                            <label htmlFor="add-intl-shipping" className="text-sm font-medium">Intl shipping</label>
                                            <Input
                                                id="add-intl-shipping"
                                                placeholder="Intl shipping"
                                                type="text"
                                                inputMode="decimal"
                                                value={addForm.intlShipping}
                                                onChange={(event) =>
                                                    setAddForm((current) => ({ ...current, intlShipping: toDecimalInput(event.target.value) }))
                                                }
                                            />
                                            {renderFieldError(addErrors, "intlShipping")}
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Currency</label>
                                            <Select
                                                value={addForm.intlShippingCurrency}
                                                onValueChange={(value) =>
                                                    setAddForm((current) => ({ ...current, intlShippingCurrency: value }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Currency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CURRENCY_OPTIONS.map((currency) => (
                                                        <SelectItem key={`intl-${currency}`} value={currency}>{currency}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Exchange rate</label>
                                            <Input
                                                placeholder={addForm.intlShippingCurrency === "RWF" ? "Not needed for RWF" : "Rate to RWF"}
                                                type="text"
                                                inputMode="decimal"
                                                disabled={addForm.intlShippingCurrency === "RWF"}
                                                value={addForm.intlShippingExchangeRate}
                                                onChange={(event) =>
                                                    setAddForm((current) => ({ ...current, intlShippingExchangeRate: toDecimalInput(event.target.value) }))
                                                }
                                            />
                                            {renderFieldError(addErrors, "intlShippingExchangeRate")}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="grid gap-1.5">
                                            <label htmlFor="add-warehouse-usa" className="text-sm font-medium">Warehouse USA</label>
                                            <Input
                                                id="add-warehouse-usa"
                                                placeholder="Warehouse USA"
                                                type="text"
                                                inputMode="decimal"
                                                value={addForm.warehouseUSA}
                                                onChange={(event) =>
                                                    setAddForm((current) => ({ ...current, warehouseUSA: toDecimalInput(event.target.value) }))
                                                }
                                            />
                                            {renderFieldError(addErrors, "warehouseUSA")}
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Currency</label>
                                            <Select
                                                value={addForm.warehouseUSACurrency}
                                                onValueChange={(value) =>
                                                    setAddForm((current) => ({ ...current, warehouseUSACurrency: value }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Currency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CURRENCY_OPTIONS.map((currency) => (
                                                        <SelectItem key={`warehouse-${currency}`} value={currency}>{currency}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Exchange rate</label>
                                            <Input
                                                placeholder={addForm.warehouseUSACurrency === "RWF" ? "Not needed for RWF" : "Rate to RWF"}
                                                type="text"
                                                inputMode="decimal"
                                                disabled={addForm.warehouseUSACurrency === "RWF"}
                                                value={addForm.warehouseUSAExchangeRate}
                                                onChange={(event) =>
                                                    setAddForm((current) => ({ ...current, warehouseUSAExchangeRate: toDecimalInput(event.target.value) }))
                                                }
                                            />
                                            {renderFieldError(addErrors, "warehouseUSAExchangeRate")}
                                        </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <div className="grid gap-1.5">
                                            <label htmlFor="add-amazon-prime" className="text-sm font-medium">Amazon Prime</label>
                                            <Input
                                                id="add-amazon-prime"
                                                placeholder="Amazon Prime"
                                                type="text"
                                                inputMode="decimal"
                                                value={addForm.amazonPrime}
                                                onChange={(event) =>
                                                    setAddForm((current) => ({ ...current, amazonPrime: toDecimalInput(event.target.value) }))
                                                }
                                            />
                                            {renderFieldError(addErrors, "amazonPrime")}
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Currency</label>
                                            <Select
                                                value={addForm.amazonPrimeCurrency}
                                                onValueChange={(value) =>
                                                    setAddForm((current) => ({ ...current, amazonPrimeCurrency: value }))
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Currency" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {CURRENCY_OPTIONS.map((currency) => (
                                                        <SelectItem key={`prime-${currency}`} value={currency}>{currency}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5">
                                            <label className="text-sm font-medium">Exchange rate</label>
                                            <Input
                                                placeholder={addForm.amazonPrimeCurrency === "RWF" ? "Not needed for RWF" : "Rate to RWF"}
                                                type="text"
                                                inputMode="decimal"
                                                disabled={addForm.amazonPrimeCurrency === "RWF"}
                                                value={addForm.amazonPrimeExchangeRate}
                                                onChange={(event) =>
                                                    setAddForm((current) => ({ ...current, amazonPrimeExchangeRate: toDecimalInput(event.target.value) }))
                                                }
                                            />
                                            {renderFieldError(addErrors, "amazonPrimeExchangeRate")}
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
                                                    addForm.pickupMethod === "easy" ? "bg-background shadow-sm" : "text-muted-foreground"
                                                )}
                                                onClick={() => handleAddPickupMethodChange("easy")}
                                            >
                                                Easy
                                            </button>
                                            <button
                                                type="button"
                                                className={cn(
                                                    "rounded px-3 py-1.5 text-sm",
                                                    addForm.pickupMethod === "advanced" ? "bg-background shadow-sm" : "text-muted-foreground"
                                                )}
                                                onClick={() => handleAddPickupMethodChange("advanced")}
                                            >
                                                Advanced
                                            </button>
                                        </div>
                                    </div>

                                    {addForm.pickupMethod === "easy" ? (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-collection-fee" className="text-sm font-medium">Collection Fee (RWF)</label>
                                                <Input
                                                    id="add-collection-fee"
                                                    placeholder="Collection Fee"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.collectionFee}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, collectionFee: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "collectionFee")}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-local-transport-easy" className="text-sm font-medium">Transport (RWF)</label>
                                                <Input
                                                    id="add-local-transport-easy"
                                                    placeholder="Transport"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.localTransport}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, localTransport: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "localTransport")}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-customs-duties" className="text-sm font-medium">Custom Duties (Tax)</label>
                                                <Input
                                                    id="add-customs-duties"
                                                    placeholder="Custom Duties"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.customsDuties}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, customsDuties: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "customsDuties")}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-arrival-notif" className="text-sm font-medium">Arrival Not.</label>
                                                <Input
                                                    id="add-arrival-notif"
                                                    placeholder="Arrival Not."
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.arrivalNotif}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, arrivalNotif: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "arrivalNotif")}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-warehouse-storage" className="text-sm font-medium">Warehouse</label>
                                                <Input
                                                    id="add-warehouse-storage"
                                                    placeholder="Warehouse"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.warehouseStorage}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, warehouseStorage: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "warehouseStorage")}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-declaration" className="text-sm font-medium">Declaration</label>
                                                <Input
                                                    id="add-declaration"
                                                    placeholder="Declaration"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.declaration}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, declaration: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "declaration")}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-local-transport-advanced" className="text-sm font-medium">Local Transport</label>
                                                <Input
                                                    id="add-local-transport-advanced"
                                                    placeholder="Local Transport"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.localTransport}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, localTransport: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "localTransport")}
                                            </div>
                                            <div className="grid gap-1.5">
                                                <label htmlFor="add-miscellaneous" className="text-sm font-medium">Miscellaneous</label>
                                                <Input
                                                    id="add-miscellaneous"
                                                    placeholder="Miscellaneous"
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={addForm.miscellaneous}
                                                    onChange={(event) =>
                                                        setAddForm((current) => ({ ...current, miscellaneous: toDecimalInput(event.target.value) }))
                                                    }
                                                />
                                                {renderFieldError(addErrors, "miscellaneous")}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Select Products</p>
                                    {renderProductSelector(addSelectedProductIds, setAddSelectedProductIds)}
                                </div>

                                {addErrors.general ? <p className="text-sm text-destructive">{addErrors.general}</p> : null}

                                <Button
                                    type="submit"
                                    disabled={isAddSubmitting || !canCreateBatch}
                                    className="disabled:opacity-50"
                                >
                                    {isAddSubmitting ? "Saving..." : "Create Batch"}
                                </Button>
                                {!canCreateBatch ? (
                                    <p className="text-xs text-muted-foreground">
                                        Add at least one expense amount and select at least one product.
                                    </p>
                                ) : null}
                            </form>
                        </div>
                    </SheetContent>
                </Sheet>
            </CardHeader>

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={batchSearch || ""}
                        onChange={(event) => setBatchSearch(event.target.value)}
                        placeholder="Search batches..."
                        className="pr-18 pl-9"
                    />
                    <KbdGroup className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex">
                        <Kbd>Ctrl</Kbd>
                        <Kbd>F</Kbd>
                    </KbdGroup>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <h3 className="text-sm text-muted-foreground">Total</h3>
                    <p className="text-sm font-semibold">{batches.length}</p>
                    {selectedBatchIds.size > 0 && (
                        <>
                            <span className="text-xs text-muted-foreground">|</span>
                            <p className="text-sm font-medium text-primary">{selectedBatchIds.size} selected</p>
                        </>
                    )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:ml-auto">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline">
                                <Columns3Icon className="h-4 w-4" />
                                Columns
                                <ChevronDownIcon className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem checked={visibleColumns.name} onCheckedChange={(value) => handleColumnVisibilityChange("name", Boolean(value))}>Name</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.tracking} onCheckedChange={(value) => handleColumnVisibilityChange("tracking", Boolean(value))}>Tracking</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.costs} onCheckedChange={(value) => handleColumnVisibilityChange("costs", Boolean(value))}>Total Costs</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.created} onCheckedChange={(value) => handleColumnVisibilityChange("created", Boolean(value))}>Created</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.actions} onCheckedChange={(value) => handleColumnVisibilityChange("actions", Boolean(value))}>Actions</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedBatchIds.size > 0 ? (
                        <>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={openBulkDeleteBatchesConfirm}
                                disabled={isBulkDeleting || isBulkDeleteInfoLoading}
                                loading={isBulkDeleting || isBulkDeleteInfoLoading}
                                loadingText={isBulkDeleteInfoLoading ? "Loading warnings" : "Deleting batches"}
                            >
                                <Trash2Icon className="h-4 w-4" />
                                {isBulkDeleting ? "Deleting..." : "Delete Selected"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedBatchIds(new Set())}
                                disabled={isBulkDeleting}
                            >
                                Clear Selection
                            </Button>
                        </>
                    ) : null}
                </div>
            </div>

            {isLoading ? (
                <div className="overflow-x-auto rounded-xl border">
                    <div className="min-w-200">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            checked={isAllBatchesSelected}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setSelectedBatchIds(new Set(sortedBatches.map((b) => b._id)))
                                                    return
                                                }
                                                setSelectedBatchIds(new Set())
                                            }}
                                            title="Select all"
                                        />
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "name") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("name")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Name
                                            {sortColumn === "name" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "tracking") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("tracking")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Tracking number
                                            {sortColumn === "tracking" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "costs") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("costs")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Total costs (RWF)
                                            {sortColumn === "costs" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "products") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("products")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Products
                                            {sortColumn === "products" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "created") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("created")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Created
                                            {sortColumn === "created" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <TableRow key={`batches-loading-${index}`}>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            ) : filteredBatches.length === 0 && batchSearch ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    No batches found matching your search.
                </div>
            ) : batches.length === 0 ? (
                <Empty className="-translate-y-5">
                    <EmptyHeader>
                        <div className="bg-border/40 mb-4 rounded-lg p-3">
                            <PackageSearchIcon className="size-10" />
                        </div>
                        <EmptyTitle>No batches yet</EmptyTitle>
                        <EmptyDescription>
                            There are no shipment batches yet. Create your first batch to start organizing imported products.
                        </EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent className="flex-row justify-center gap-2">
                        <Button onClick={() => setIsAddSheetOpen(true)} className="h-9 px-4">Add your first batch</Button>
                    </EmptyContent>
                </Empty>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <div className="min-w-200">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            checked={isAllBatchesSelected}
                                            onChange={(event) => {
                                                if (event.target.checked) {
                                                    setSelectedBatchIds(new Set(sortedBatches.map((b) => b._id)))
                                                    return
                                                }
                                                setSelectedBatchIds(new Set())
                                            }}
                                            title="Select all"
                                        />
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "name") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("name")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Name
                                            {sortColumn === "name" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "tracking") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("tracking")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Tracking number
                                            {sortColumn === "tracking" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "costs") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("costs")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Total costs (RWF)
                                            {sortColumn === "costs" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "products") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("products")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Products
                                            {sortColumn === "products" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (sortColumn === "created") {
                                                    setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
                                                    return
                                                }
                                                setSortColumn("created")
                                                setSortDirection("asc")
                                            }}
                                            className="flex items-center gap-1"
                                        >
                                            Created
                                            {sortColumn === "created" ? (sortDirection === "asc" ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />) : null}
                                        </button>
                                    </TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedBatches.map((batch) => (
                                    <TableRow
                                        key={batch._id}
                                        className={selectedBatchIds.has(batch._id) ? "bg-primary/20 text-foreground cursor-pointer" : "hover:bg-muted/40 cursor-pointer"}
                                        onClick={() => router.push(`/app/batches/${batch._id}`)}
                                    >
                                        <TableCell onClick={(event) => event.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                className="rounded"
                                                checked={selectedBatchIds.has(batch._id)}
                                                onChange={(event) => {
                                                    const nextSelected = new Set(selectedBatchIds)
                                                    if (event.target.checked) {
                                                        nextSelected.add(batch._id)
                                                    } else {
                                                        nextSelected.delete(batch._id)
                                                    }
                                                    setSelectedBatchIds(nextSelected)
                                                }}
                                                title={`Select ${batch.batchName}`}
                                            />
                                        </TableCell>
                                        <TableCell className="font-medium hover:underline">{batch.batchName}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                            <div className="flex items-center gap-2">
                                                <span className="truncate">{batch.trackingId || "-"}</span>
                                                {batch.trackingId ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                        onClick={(event) => {
                                                            event.stopPropagation()
                                                            void copyTrackingId(batch.trackingId ?? "")
                                                        }}
                                                        aria-label={`Copy tracking number for ${batch.batchName}`}
                                                    >
                                                        <CopyIcon className="h-4 w-4" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell>{getBatchTotalCosts(batch).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell>{batch.productCount ?? 0}</TableCell>
                                        <TableCell>{new Date(batch.createdAt).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDeleteBatch(batch)}
                                            >
                                                <Trash2Icon className="h-4 w-4" />
                                                Delete
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}

            {showBulkDeleteConfirm ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200">
                    <div className="modal-pop-in bg-card rounded-lg shadow-lg w-full max-w-sm border border-border">
                        <div className="p-6 space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Delete Selected Batches?</h2>
                                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
                            </div>

                            {isBulkDeleteInfoLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-3 w-2/3" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            ) : (bulkDeleteWarningSummary.totalProducts > 0 || bulkDeleteWarningSummary.batchesWithSales > 0) ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">Warning</p>
                                    <ul className="list-disc list-inside mt-1 text-sm text-amber-800 dark:text-amber-300 space-y-1">
                                        {bulkDeleteWarningSummary.totalProducts > 0 ? (
                                            <li>
                                                <span className="font-medium">{bulkDeleteWarningSummary.totalProducts}</span>
                                                {" "}
                                                product{bulkDeleteWarningSummary.totalProducts === 1 ? "" : "s"}
                                                {" "}
                                                {bulkDeleteWarningSummary.totalProducts === 1 ? "is" : "are"}
                                                {" "}
                                                linked to the selected batch{selectedBatchIds.size === 1 ? "" : "es"}.
                                            </li>
                                        ) : null}
                                        {bulkDeleteWarningSummary.batchesWithSales > 0 ? (
                                            <li>
                                                <span className="font-medium">{bulkDeleteWarningSummary.batchesWithSales}</span>
                                                {" "}
                                                selected batch{bulkDeleteWarningSummary.batchesWithSales === 1 ? "" : "es"}
                                                {" "}
                                                {bulkDeleteWarningSummary.batchesWithSales === 1 ? "includes" : "include"}
                                                {" "}
                                                products with sales,
                                                {" "}
                                                with a total of
                                                {" "}
                                                <span className="font-medium">{bulkDeleteWarningSummary.totalSalesRecords}</span>
                                                {" "}
                                                sale record{bulkDeleteWarningSummary.totalSalesRecords === 1 ? "" : "s"}.
                                            </li>
                                        ) : null}
                                    </ul>
                                </div>
                            ) : null}

                            {bulkDeleteError ? <p className="text-xs text-destructive">{bulkDeleteError}</p> : null}

                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        if (isBulkDeleting) {
                                            return
                                        }
                                        setShowBulkDeleteConfirm(false)
                                        setIsBulkDeleteInfoLoading(false)
                                    }}
                                    disabled={isBulkDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={removeSelectedBatches}
                                    disabled={isBulkDeleting || isBulkDeleteInfoLoading}
                                    loading={isBulkDeleting || isBulkDeleteInfoLoading}
                                    loadingText={isBulkDeleteInfoLoading ? "Loading warnings" : "Deleting batches"}
                                >
                                    Delete Selected
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {showDeleteConfirm && deleteConfirmData ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
                    onClick={() => {
                        if (isDeleting) {
                            return
                        }

                        setShowDeleteConfirm(false)
                        setDeleteConfirmData(null)
                        setIsDeleteInfoLoading(false)
                    }}
                >
                    <div
                        className="modal-pop-in bg-card rounded-lg shadow-lg w-full max-w-sm border border-border"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-6 space-y-4">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Delete Batch?</h2>
                                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
                            </div>
                            {isDeleteInfoLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-3 w-2/3" />
                                    <Skeleton className="h-3 w-1/2" />
                                </div>
                            ) : (deleteConfirmData.productCount > 0 || deleteConfirmData.hasActiveSales) ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <div>
                                        <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">Warning</p>
                                        <ul className="list-disc list-inside mt-1 text-sm text-amber-800 dark:text-amber-300">
                                            <li>Batch: <span className="font-medium">{deleteConfirmData.batchName}</span></li>
                                            <li>Contains <span className="font-medium">{deleteConfirmData.productCount}</span> product{deleteConfirmData.productCount !== 1 ? "s" : ""}</li>
                                            {deleteConfirmData.hasActiveSales ? (
                                                <li><span className="font-medium">{deleteConfirmData.salesCount}</span> sale{deleteConfirmData.salesCount !== 1 ? "s" : ""} recorded for products in this batch</li>
                                            ) : null}
                                        </ul>
                                    </div>
                                </div>
                            ) : null}
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowDeleteConfirm(false)
                                        setDeleteConfirmData(null)
                                        setIsDeleteInfoLoading(false)
                                    }}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="destructive"
                                    onClick={confirmDeleteBatch}
                                    disabled={isDeleting || isDeleteInfoLoading}
                                    loading={isDeleting || isDeleteInfoLoading}
                                    loadingText={isDeleteInfoLoading ? "Loading warnings" : "Deleting batch"}
                                >
                                    Delete Batch
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
