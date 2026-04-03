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
import { cn } from "@/lib/utils"
import { CheckIcon, PackageSearchIcon } from "lucide-react"

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
            return expenseFieldKeys.some((key) => Number(stripCommas(form[key]) || 0) > 0)
        },
        []
    )

    const unassignedProducts = React.useMemo(() => {
        return products.filter((product) => !product.batchId?._id)
    }, [products])

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

            const payload = Object.fromEntries(
                Object.entries(addForm).map(([key, value]) => {
                    if (key === "batchName") return [key, value]
                    return [key, Number(stripCommas(value) || 0)]
                })
            )

            const response = await fetch("/api/batches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
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
                                isSelected ? "bg-border/60" : "hover:bg-muted/40"
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
                    <SheetContent className="p-0">
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
                                <div className="grid gap-3 sm:grid-cols-2">
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
                                        <label htmlFor="add-tax-value" className="text-sm font-medium">Tax value</label>
                                        <Input
                                            id="add-tax-value"
                                            placeholder="Tax value"
                                            type="text"
                                            inputMode="decimal"
                                            value={addForm.taxValue}
                                            onChange={(event) =>
                                                setAddForm((current) => ({ ...current, taxValue: toDecimalInput(event.target.value) }))
                                            }
                                        />
                                        {renderFieldError(addErrors, "taxValue")}
                                    </div>
                                    <div className="grid gap-1.5">
                                        <label htmlFor="add-customs-duties" className="text-sm font-medium">Customs duties</label>
                                        <Input
                                            id="add-customs-duties"
                                            placeholder="Customs duties"
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
                                        <label htmlFor="add-arrival-notif" className="text-sm font-medium">Arrival notification</label>
                                        <Input
                                            id="add-arrival-notif"
                                            placeholder="Arrival notif"
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
                                        <label htmlFor="add-warehouse-storage" className="text-sm font-medium">Warehouse storage</label>
                                        <Input
                                            id="add-warehouse-storage"
                                            placeholder="Warehouse storage"
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
                                    <div className="grid gap-1.5 sm:col-span-2">
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
                    <div className="min-w-[720px]">
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
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <TableRow key={`batches-loading-${index}`}>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
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
                    <div className="min-w-[720px]">
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
                                    <TableRow
                                        key={batch._id}
                                        className="cursor-pointer"
                                        onClick={() => router.push(`/app/batches/${batch._id}`)}
                                    >
                                        <TableCell className="font-medium">{batch.batchName}</TableCell>
                                        <TableCell>{batch.intlShipping.toLocaleString()}</TableCell>
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
