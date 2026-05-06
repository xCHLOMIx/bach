"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

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
import { Layers3Icon, SearchIcon, PencilIcon, ShoppingCartIcon } from "lucide-react"

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

const GROUP_SALE_PRODUCT_IDS_KEY = "pending-group-sale-product-ids"

function money(value: number) {
    return `${formatRWF(value)} RWF`
}

export function GroupsPage() {
    const router = useRouter()
    const [rows, setRows] = React.useState<GroupRow[]>([])
    const [products, setProducts] = React.useState<GroupProduct[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [search, setSearch] = React.useState("")
    const [isGroupSheetOpen, setIsGroupSheetOpen] = React.useState(false)
    const [editingGroup, setEditingGroup] = React.useState<GroupRow | null>(null)

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
    const groupedProductIds = React.useMemo(() => new Set(groupsOnly.flatMap((row) => row.productIds)), [groupsOnly])
    const groupSheetProducts = React.useMemo(() => {
        if (!editingGroup) {
            return products.filter((product) => !groupedProductIds.has(product._id))
        }

        const allowed = new Set(editingGroup.productIds)
        return products.filter((product) => !groupedProductIds.has(product._id) || allowed.has(product._id))
    }, [editingGroup, groupedProductIds, products])

    const filteredRows = React.useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return groupsOnly
        return groupsOnly.filter((row) => [row.name, row.batchName].join(" ").toLowerCase().includes(query))
    }, [groupsOnly, search])

    const openCreateGroup = () => {
        setEditingGroup(null)
        setIsGroupSheetOpen(true)
    }

    const openEditGroup = (row: GroupRow) => {
        setEditingGroup(row)
        setIsGroupSheetOpen(true)
    }

    const sellProducts = (productIds: string[]) => {
        window.sessionStorage.setItem(GROUP_SALE_PRODUCT_IDS_KEY, JSON.stringify(productIds))
        router.push("/app/sales")
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
                    <Button onClick={openCreateGroup} className="w-full h-12 px-6 lg:w-auto">Create new group</Button>
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
                            <TableHeader className="bg-[#F2F2F2] sticky top-0 z-1">
                                <TableRow>
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
                                        <TableRow key={index}>
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
                                    ))
                                ) : filteredRows.length === 0 && search ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                                            No groups match your search.
                                        </TableCell>
                                    </TableRow>
                                ) : groupsOnly.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="p-8">
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
                                    filteredRows.map((row) => (
                                        <TableRow key={row._id}>
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
                                                    <Button type="button" variant="default" size="sm" onClick={() => sellProducts(row.productIds)}>
                                                        <ShoppingCartIcon className="size-4" />
                                                        Sell all
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            <GroupSheet
                open={isGroupSheetOpen}
                onOpenChange={(open) => {
                    setIsGroupSheetOpen(open)
                    if (!open) {
                        setEditingGroup(null)
                    }
                }}
                products={groupSheetProducts}
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