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
import { CheckIcon, CopyIcon, PackageSearchIcon } from "lucide-react"

const CURRENCY_OPTIONS = ["RWF", "USD", "CNY", "EUR"] as const
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
    products?: Array<{
        _id: string
        name: string
        quantityRemaining: number
    }>
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

    const copyTrackingId = React.useCallback(async (trackingId: string) => {
        if (!trackingId.trim()) {
            return
        }

        await navigator.clipboard.writeText(trackingId.trim())
    }, [])

    const hasSelectedProducts = addSelectedProductIds.length > 0
    const canCreateBatch = hasAnyExpenseAmount(addForm) && hasSelectedProducts

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
                                index === products.length - 1 && "rounded-b-md",
                                isSelected
                                    ? "bg-primary/20 text-foreground ring-1 ring-inset ring-primary/40"
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
            <CardHeader className="flex flex-col gap-3 px-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <CardTitle className="text-2xl font-bold">Batches</CardTitle>
                    <CardDescription>Create, edit, and manage products in each batch.</CardDescription>
                </div>
                <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
                    <SheetTrigger asChild>
                        <Button className="h-10 px-6" size={"lg"}>Add Batch</Button>
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

            {isLoading ? (
                <div className="overflow-x-auto rounded-xl border">
                    <div className="min-w-180">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Tracking number</TableHead>
                                    <TableHead>Total costs (RWF)</TableHead>
                                    <TableHead>Products</TableHead>
                                    <TableHead>Product Names</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <TableRow key={`batches-loading-${index}`}>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
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
                    <div className="min-w-180">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Tracking number</TableHead>
                                    <TableHead>Total costs (RWF)</TableHead>
                                    <TableHead>Products</TableHead>
                                    <TableHead>Product Names</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {batches.map((batch) => (
                                    <TableRow
                                        key={batch._id}
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/app/batches/${batch._id}`)}
                                    >
                                        <TableCell className="font-medium">{batch.batchName}</TableCell>
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
                                        <TableCell className="truncate max-w-xs">
                                            {batch.products?.length
                                                ? batch.products.map((product) => product.name).join(", ")
                                                : "-"}
                                        </TableCell>
                                        <TableCell>{new Date(batch.createdAt).toLocaleDateString()}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    )
}
