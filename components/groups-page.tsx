"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Empty, EmptyHeader, EmptyContent, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { GroupSheet } from "@/components/group-sheet"
import { formatRWF } from "@/lib/utils"
import { Layers3Icon, SearchIcon, PencilIcon, ShoppingCartIcon, ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react"
import { toast } from "sonner"

type GroupRow = {
    _id: string
    type: "group" | "product"
    name: string
    productIds: string[]
    productQuantities?: Record<string, number>
    productCount: number
    batchName: string
    createdAt: string
    purchaseTotal: number
    landedCostTotal: number
    sellingPriceTotal: number
    profitTotal: number
}

type GroupProduct = {
    _id: string
    name: string
    quantityRemaining: number
    purchasePriceRWF: number
    landedCost: number
    intendedSellingPrice?: number | null
    batchId?: { batchName?: string } | null
}

type GroupsResponse = {
    rows: GroupRow[]
    products: GroupProduct[]
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

function money(value: number) {
    return `${formatRWF(value)} RWF`
}

export function GroupsPage() {
    const [rows, setRows] = React.useState<GroupRow[]>([])
    const [products, setProducts] = React.useState<GroupProduct[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [search, setSearch] = React.useState("")
    const [isGroupSheetOpen, setIsGroupSheetOpen] = React.useState(false)
    const [editingGroup, setEditingGroup] = React.useState<GroupRow | null>(null)
    const [expandedGroupIds, setExpandedGroupIds] = React.useState<Set<string>>(new Set())
    const [sellModalOpen, setSellModalOpen] = React.useState(false)
    const [sellModalGroup, setSellModalGroup] = React.useState<GroupRow | null>(null)
    const [bulkSaleRows, setBulkSaleRows] = React.useState<BulkSaleRow[]>([])
    const [bulkSaleRowErrors, setBulkSaleRowErrors] = React.useState<BulkSaleRowErrors>({})
    const [bulkSaleGeneralError, setBulkSaleGeneralError] = React.useState("")
    const [isSaving, setIsSaving] = React.useState(false)

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

    const load = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/groups")
            if (!response.ok) return
            const data = (await response.json()) as GroupsResponse
            setRows(Array.isArray(data.rows) ? data.rows : [])
            setProducts(Array.isArray(data.products) ? data.products : [])
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        void load()
    }, [load])

    const groupsOnly = React.useMemo(() => rows.filter((r) => r.type === "group"), [rows])
    const groupQuantitiesByProductId = React.useMemo(() => {
        const nextTotals: Record<string, number> = {}

        for (const row of groupsOnly) {
            for (const [productId, quantity] of Object.entries(row.productQuantities ?? {})) {
                nextTotals[productId] = (nextTotals[productId] ?? 0) + Math.max(0, Math.floor(quantity))
            }
        }

        return nextTotals
    }, [groupsOnly])

    const availableQuantitiesByProductId = React.useMemo(() => {
        const nextAvailable: Record<string, number> = {}

        for (const product of products) {
            const allocatedQuantity = groupQuantitiesByProductId[product._id] ?? 0
            const currentGroupQuantity = editingGroup?.productQuantities?.[product._id] ?? 0
            nextAvailable[product._id] = Math.max(0, (product.quantityRemaining ?? 0) - allocatedQuantity + currentGroupQuantity)
        }

        return nextAvailable
    }, [editingGroup, groupQuantitiesByProductId, products])

    const groupSheetProducts = React.useMemo(() => products, [products])

    const filteredRows = React.useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return groupsOnly
        return groupsOnly.filter((row) => [row.name, row.batchName].join(" ").toLowerCase().includes(search))
    }, [groupsOnly, search])

    const productsById = React.useMemo(() => {
        return new Map(products.map((p) => [p._id, p]))
    }, [products])

    const openCreateGroup = () => {
        setEditingGroup(null)
        setIsGroupSheetOpen(true)
    }

    const openEditGroup = (row: GroupRow) => {
        setEditingGroup(row)
        setIsGroupSheetOpen(true)
    }

    const toggleExpandGroup = (groupId: string) => {
        setExpandedGroupIds((current) => {
            const next = new Set(current)
            if (next.has(groupId)) {
                next.delete(groupId)
            } else {
                next.add(groupId)
            }
            return next
        })
    }

    const openSellModal = (group: GroupRow) => {
        setSellModalGroup(group)
        const rows = group.productIds
            .map((productId) => {
                const product = productsById.get(productId)
                if (!product) return null
                return {
                    productId: product._id,
                    name: product.name,
                    availableQuantity: product.quantityRemaining,
                    landedCost: product.landedCost,
                    quantity: String(group.productQuantities?.[productId] ?? 1),
                    sellingPrice: typeof product.intendedSellingPrice === "number" ? formatDecimalWithCommas(String(product.intendedSellingPrice)) : "",
                }
            })
            .filter(Boolean) as BulkSaleRow[]

        setBulkSaleRows(rows)
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
        setSellModalOpen(true)
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

            responses.forEach((response, index) => {
                if (!response.ok) {
                    failedProducts.push(bulkSaleRows[index].name)
                }
            })

            if (failedProducts.length > 0) {
                setBulkSaleGeneralError(`Failed to record sale for: ${failedProducts.join(", ")}`)
                return
            }

            setSellModalOpen(false)
            await load()
            toast.success("Sales recorded successfully!")
        } finally {
            setIsSaving(false)
        }
    }

    const closeSellModal = () => {
        setSellModalOpen(false)
        setSellModalGroup(null)
        setBulkSaleRows([])
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
    }

    return (
        <div className="flex flex-1 flex-col gap-4 py-4 lg:py-6">
            <div className="flex flex-col gap-4 px-4 lg:px-6">
                <div className="flex flex-col gap-3 rounded-2xl bg-background lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Groups</h1>
                            <p className="text-sm text-muted-foreground">Bundle products together and sell them as one setup.</p>
                        </div>
                    </div>
                    <Button onClick={openCreateGroup} className="h-12 w-full px-6 lg:w-auto">Create new group</Button>
                </div>

                <div className="flex items-center gap-2 rounded-xl border bg-background px-3 py-2">
                    <SearchIcon className="size-4 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search groups or products"
                        className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    />
                </div>
            </div>

            <div className="px-4 lg:px-6">
                <div className="overflow-hidden rounded-xl border">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="sticky top-0 z-10 bg-background">
                                <TableRow>
                                    <TableHead className="w-12"></TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="text-right">Products</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Purchase</TableHead>
                                    <TableHead className="text-right">Landed Costs</TableHead>
                                    <TableHead className="text-right">Selling Price</TableHead>
                                    <TableHead className="text-right">Profit</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    Array.from({ length: 5 }).map((_, index) => (
                                        <React.Fragment key={index}>
                                            <TableRow className="hover:bg-muted/40">
                                                <TableCell><Skeleton className="h-4 w-6" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-10" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-16" /></TableCell>
                                                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-24" /></TableCell>
                                            </TableRow>
                                        </React.Fragment>
                                    ))
                                ) : filteredRows.length === 0 && search ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                                            No groups match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : groupsOnly.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={10} className="p-8">
                                            <Empty className="-translate-y-5">
                                                <EmptyHeader>
                                                    <div className="bg-border/40 mb-4 rounded-lg p-3">
                                                        <Layers3Icon className="size-10" />
                                                    </div>
                                                    <EmptyTitle>No groups yet</EmptyTitle>
                                                    <EmptyDescription>
                                                        Create a group to bundle products you sell together.
                                                    </EmptyDescription>
                                                </EmptyHeader>
                                                <EmptyContent className="flex-row justify-center gap-2">
                                                    <Button onClick={openCreateGroup} className="h-9 px-4">Create your first group</Button>
                                                </EmptyContent>
                                            </Empty>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredRows.map((row) => {
                                        const isExpanded = expandedGroupIds.has(row._id)
                                        const groupProducts = row.productIds
                                            .map((productId) => productsById.get(productId))
                                            .filter(Boolean) as GroupProduct[]

                                        return (
                                            <React.Fragment key={row._id}>
                                                <TableRow className="hover:bg-muted/40">
                                                    <TableCell className="w-12">
                                                        {row.type === "group" && (
                                                            <button
                                                                onClick={() => toggleExpandGroup(row._id)}
                                                                className="p-1 hover:bg-muted rounded-md transition-colors"
                                                                aria-label={isExpanded ? "Collapse" : "Expand"}
                                                            >
                                                                {isExpanded ? (
                                                                    <ChevronDownIcon className="size-4" />
                                                                ) : (
                                                                    <ChevronRightIcon className="size-4" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <span className="truncate">{row.name}</span>
                                                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                                                {row.type}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right">{row.productCount}</TableCell>
                                                    <TableCell>{row.batchName}</TableCell>
                                                    <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                                                    <TableCell className="text-right">{money(row.purchaseTotal)}</TableCell>
                                                    <TableCell className="text-right">{money(row.landedCostTotal)}</TableCell>
                                                    <TableCell className="text-right">{money(row.sellingPriceTotal)}</TableCell>
                                                    <TableCell className="text-right">{money(row.profitTotal)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button type="button" variant="outline" size="sm" onClick={() => openEditGroup(row)}>
                                                                <PencilIcon className="size-4" />
                                                                Edit
                                                            </Button>
                                                            <Button type="button" variant="default" size="sm" onClick={() => openSellModal(row)}>
                                                                <ShoppingCartIcon className="size-4" />
                                                                Sell all
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {isExpanded && row.type === "group" && (
                                                    <TableRow className="bg-muted/30">
                                                        <TableCell colSpan={10} className="p-0">
                                                            <div className="p-4">
                                                                <div className="text-sm font-semibold mb-3 text-foreground">Products in this group:</div>
                                                                <div className="space-y-2">
                                                                    {groupProducts.map((product) => {
                                                                        const quantity = row.productQuantities?.[product._id] ?? 1
                                                                        return (
                                                                            <div key={product._id} className="flex items-center justify-between p-3 bg-background rounded-lg border border-border/50">
                                                                                <div className="flex-1 min-w-0">
                                                                                    <p className="font-medium text-foreground truncate">{product.name}</p>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        {quantity > 1 ? `${quantity} units in group` : "1 unit in group"} · Stock: {Math.max(0, availableQuantitiesByProductId[product._id] ?? product.quantityRemaining)}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="text-right ml-4">
                                                                                    <p className="text-sm font-medium text-foreground">{money(product.landedCost * quantity)}</p>
                                                                                    <p className="text-xs text-muted-foreground">Landed cost</p>
                                                                                </div>
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {sellModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
                    onClick={closeSellModal}
                >
                    <div
                        className="modal-pop-in bg-card rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-border"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-foreground">
                                    Sell {sellModalGroup?.name}
                                </h2>
                                <button
                                    type="button"
                                    onClick={closeSellModal}
                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="Close sale modal"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-muted-foreground">
                                    Enter selling price for each product. Quantities are pre-filled from your group.
                                </p>
                            </div>

                            <div className="space-y-4 mb-6 max-h-[55vh] overflow-y-auto pr-1">
                                {bulkSaleRows.map((row) => {
                                    const quantityValue = Number(row.quantity || 0)
                                    const sellingPriceValue = Number(stripCommas(row.sellingPrice) || 0)
                                    const buyingPricePerUnit = row.landedCost
                                    const profitPerUnit = sellingPriceValue - buyingPricePerUnit
                                    const totalProfit = profitPerUnit * quantityValue

                                    return (
                                        <div key={row.productId} className="rounded-lg border border-border p-3">
                                            <div className="mb-3">
                                                <h3 className="font-medium text-foreground truncate">{row.name}</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    Quantity: {row.quantity} â€¢ Available: {row.availableQuantity}
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3">
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
                                                <p>Buying price / unit: <span className="font-semibold text-foreground">{formatRWF(buyingPricePerUnit)} RWF</span></p>
                                                <p>Selling price / unit: <span className="font-semibold text-foreground">{formatRWF(sellingPriceValue)} RWF</span></p>
                                                <p>
                                                    {profitPerUnit >= 0 ? "Profit / unit" : "Loss / unit"}: <span className={profitPerUnit >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>{formatRWF(Math.abs(profitPerUnit))} RWF</span>
                                                </p>
                                                <p>
                                                    Total {totalProfit >= 0 ? "profit" : "loss"}: <span className={totalProfit >= 0 ? "font-semibold text-primary" : "font-semibold text-destructive"}>{formatRWF(Math.abs(totalProfit))} RWF</span>
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
                                    onClick={closeSellModal}
                                    className="flex-1"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleSaveSale}
                                    disabled={!bulkSaleRows.length || isSaving}
                                    className="flex-1 disabled:opacity-40"
                                >
                                    {isSaving ? "Saving..." : "Record Sale"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <GroupSheet
                open={isGroupSheetOpen}
                onOpenChange={(open) => {
                    setIsGroupSheetOpen(open)
                    if (!open) {
                        setEditingGroup(null)
                    }
                }}
                products={groupSheetProducts}
                availableQuantities={availableQuantitiesByProductId}
                group={
                    editingGroup
                        ? {
                            _id: editingGroup._id,
                            name: editingGroup.name,
                            productIds: editingGroup.productIds,
                            productQuantities: editingGroup.productQuantities,
                        }
                        : null
                }
                onSaved={load}
            />
        </div>
    )
}
