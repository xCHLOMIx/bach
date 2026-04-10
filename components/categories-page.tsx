"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Trash2Icon, SearchIcon, ChevronUpIcon, ChevronDownIcon, Columns3Icon } from "lucide-react"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"

const CATEGORIES_VISIBLE_COLUMNS_STORAGE_KEY = "categories:visible-columns"
const CATEGORIES_TABLE_STATE_STORAGE_KEY = "categories:table-state"

type Category = {
    _id: string
    name: string
    createdAt: string
}

export function CategoriesPage() {
    const [categories, setCategories] = React.useState<Category[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [newName, setNewName] = React.useState("")
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [editingId, setEditingId] = React.useState("")
    const [editingName, setEditingName] = React.useState("")
    const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<Set<string>>(new Set())
    const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
    const [isBulkDeleteInfoLoading, setIsBulkDeleteInfoLoading] = React.useState(false)
    const [bulkDeleteError, setBulkDeleteError] = React.useState("")
    const [bulkDeleteWarningSummary, setBulkDeleteWarningSummary] = React.useState({
        categoriesWithProducts: 0,
        totalLinkedProducts: 0,
    })
    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
    const [deleteConfirmData, setDeleteConfirmData] = React.useState<{
        categoryId: string
        categoryName: string
        productCount: number
        hasLinkedProducts: boolean
    } | null>(null)
    const [isDeleteInfoLoading, setIsDeleteInfoLoading] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [categorySearch, setCategorySearch] = React.useState("")
    const [sortColumn, setSortColumn] = React.useState<"name" | "created">("created")
    const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("desc")
    const [visibleColumns, setVisibleColumns] = React.useState({ name: true, created: true, actions: true })

    const load = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const response = await fetch("/api/categories")
            if (!response.ok) return
            const data = await response.json()
            setCategories(data.categories ?? [])
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        load()
    }, [load])

    React.useEffect(() => {
        const savedVisibleColumnsRaw = window.localStorage.getItem(CATEGORIES_VISIBLE_COLUMNS_STORAGE_KEY)
        if (!savedVisibleColumnsRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedVisibleColumnsRaw) as Partial<typeof visibleColumns>
            setVisibleColumns((current) => ({
                ...current,
                name: typeof parsed.name === "boolean" ? parsed.name : current.name,
                created: typeof parsed.created === "boolean" ? parsed.created : current.created,
                actions: typeof parsed.actions === "boolean" ? parsed.actions : current.actions,
            }))
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(CATEGORIES_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
    }, [visibleColumns])

    React.useEffect(() => {
        const savedTableStateRaw = window.localStorage.getItem(CATEGORIES_TABLE_STATE_STORAGE_KEY)
        if (!savedTableStateRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedTableStateRaw) as {
                categorySearch?: string
                sortColumn?: "name" | "created"
                sortDirection?: "asc" | "desc"
            }

            if (typeof parsed.categorySearch === "string") {
                setCategorySearch(parsed.categorySearch)
            }
            if (parsed.sortColumn === "name" || parsed.sortColumn === "created") {
                setSortColumn(parsed.sortColumn)
            }
            if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") {
                setSortDirection(parsed.sortDirection)
            }
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(
            CATEGORIES_TABLE_STATE_STORAGE_KEY,
            JSON.stringify({
                categorySearch,
                sortColumn,
                sortDirection,
            })
        )
    }, [categorySearch, sortColumn, sortDirection])

    const createCategory = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setErrors({})

        const response = await fetch("/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
        })

        const data = await response.json()
        if (!response.ok) {
            setErrors(data.errors ?? { general: "Failed to create category" })
            return
        }

        setNewName("")
        await load()
    }

    const saveEdit = async () => {
        const response = await fetch(`/api/categories/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: editingName }),
        })

        const data = await response.json()
        if (!response.ok) {
            setErrors(data.errors ?? { general: "Failed to update category" })
            return
        }

        setEditingId("")
        setEditingName("")
        await load()
    }

    const handleDeleteCategory = async (category: Category) => {
        setDeleteConfirmData({
            categoryId: category._id,
            categoryName: category.name,
            productCount: 0,
            hasLinkedProducts: false,
        })
        setShowDeleteConfirm(true)
        setIsDeleteInfoLoading(true)

        try {
            const response = await fetch(`/api/categories/${category._id}`, {
                method: "DELETE",
            })

            const data = await response.json()
            if (!response.ok) {
                setErrors(data.errors ?? { general: "Failed to get deletion info" })
                return
            }

            setDeleteConfirmData((current) => {
                if (!current || current.categoryId !== category._id) {
                    return current
                }

                return {
                    ...current,
                    productCount: data.deletionInfo?.productCount ?? 0,
                    hasLinkedProducts: Boolean(data.deletionInfo?.hasLinkedProducts),
                }
            })
        } catch {
            setErrors({ general: "Failed to get deletion info" })
        } finally {
            setIsDeleteInfoLoading(false)
        }
    }

    const confirmDeleteCategory = async () => {
        if (!deleteConfirmData || isDeleteInfoLoading) {
            return
        }

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/categories/${deleteConfirmData.categoryId}?confirm=true`, {
                method: "DELETE",
            })

            if (!response.ok) {
                const data = await response.json()
                setErrors(data.errors ?? { general: "Failed to delete category" })
                return
            }

            setSelectedCategoryIds((current) => {
                const next = new Set(current)
                next.delete(deleteConfirmData.categoryId)
                return next
            })
            setShowDeleteConfirm(false)
            setDeleteConfirmData(null)
            setIsDeleteInfoLoading(false)
            await load()
        } catch {
            setErrors({ general: "Failed to delete category" })
        } finally {
            setIsDeleting(false)
        }
    }

    const removeSelectedCategories = async () => {
        if (selectedCategoryIds.size === 0) {
            return
        }

        if (isBulkDeleteInfoLoading) {
            return
        }

        setErrors({})
        setIsBulkDeleting(true)

        try {
            const failedIds: string[] = []

            for (const categoryId of selectedCategoryIds) {
                const response = await fetch(`/api/categories/${categoryId}?confirm=true`, {
                    method: "DELETE",
                })

                if (!response.ok) {
                    failedIds.push(categoryId)
                }
            }

            if (failedIds.length > 0) {
                setErrors({ general: `Failed to delete ${failedIds.length} selected categories` })
                return
            }

            setSelectedCategoryIds(new Set())
            setShowBulkDeleteConfirm(false)
            await load()
        } finally {
            setIsBulkDeleting(false)
        }
    }

    const openBulkDeleteCategoriesConfirm = React.useCallback(() => {
        if (selectedCategoryIds.size === 0) {
            return
        }

        const selectedCategories = categories.filter((category) => selectedCategoryIds.has(category._id))

        setBulkDeleteError("")
        setShowBulkDeleteConfirm(true)
        setIsBulkDeleteInfoLoading(true)
        setBulkDeleteWarningSummary({ categoriesWithProducts: 0, totalLinkedProducts: 0 })

        void (async () => {
            try {
                const responses = await Promise.all(
                    selectedCategories.map((category) =>
                        fetch(`/api/categories/${category._id}`, {
                            method: "DELETE",
                        })
                    )
                )

                let categoriesWithProducts = 0
                let totalLinkedProducts = 0

                for (const response of responses) {
                    const data = await response.json().catch(() => null)
                    if (!response.ok || !data?.deletionInfo) {
                        continue
                    }

                    const productCount = Number(data.deletionInfo.productCount ?? 0)
                    totalLinkedProducts += productCount
                    if (productCount > 0) {
                        categoriesWithProducts += 1
                    }
                }

                setBulkDeleteWarningSummary({
                    categoriesWithProducts,
                    totalLinkedProducts,
                })
            } catch {
                setBulkDeleteError("Failed to load bulk delete warnings")
            } finally {
                setIsBulkDeleteInfoLoading(false)
            }
        })()
    }, [categories, selectedCategoryIds])

    const handleColumnVisibilityChange = (columnKey: string, value: boolean) => {
        setVisibleColumns((current) => ({ ...current, [columnKey]: value }))
    }

    const isAllSelected = categories.length > 0 && selectedCategoryIds.size === categories.length

    const filteredCategories = React.useMemo(() => {
        const searchLower = categorySearch.toLowerCase().trim()
        return categories.filter((category) =>
            category.name.toLowerCase().includes(searchLower)
        )
    }, [categories, categorySearch])

    const sortedCategories = React.useMemo(() => {
        const sorted = [...filteredCategories]
        const stringCollator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

        sorted.sort((a, b) => {
            let aVal: string | number = ""
            let bVal: string | number = ""

            if (sortColumn === "name") {
                aVal = a.name
                bVal = b.name
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
    }, [filteredCategories, sortColumn, sortDirection])

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="flex items-center justify-between gap-3 px-0">
                <div>
                    <CardTitle className="text-2xl font-bold">Categories</CardTitle>
                    <CardDescription>Create, update, and delete categories.</CardDescription>
                </div>
                <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={createCategory} onKeyDown={preventImplicitSubmitOnEnter}>
                    <Input
                        placeholder="Category name"
                        className="h-10 min-w-0 w-40"
                        value={newName || ""}
                        onChange={(event) => setNewName(event.target.value)}
                    />
                    <Button type="submit" size={"lg"} className="h-10 px-6">Add</Button>
                </form>
            </CardHeader>

            {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
            {errors.general ? <p className="text-sm text-destructive">{errors.general}</p> : null}

            <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                    <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={categorySearch || ""}
                        onChange={(event) => setCategorySearch(event.target.value)}
                        placeholder="Search categories..."
                        className="pr-18 pl-9"
                    />
                    <KbdGroup className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex">
                        <Kbd>Ctrl</Kbd>
                        <Kbd>F</Kbd>
                    </KbdGroup>
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <h3 className="text-sm text-muted-foreground">Total</h3>
                    <p className="text-sm font-semibold">{categories.length}</p>
                    {selectedCategoryIds.size > 0 && (
                        <>
                            <span className="text-xs text-muted-foreground">|</span>
                            <p className="text-sm font-medium text-primary">{selectedCategoryIds.size} selected</p>
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
                            <DropdownMenuCheckboxItem checked={visibleColumns.created} onCheckedChange={(value) => handleColumnVisibilityChange("created", Boolean(value))}>Created</DropdownMenuCheckboxItem>
                            <DropdownMenuCheckboxItem checked={visibleColumns.actions} onCheckedChange={(value) => handleColumnVisibilityChange("actions", Boolean(value))}>Actions</DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {selectedCategoryIds.size > 0 ? (
                        <>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={openBulkDeleteCategoriesConfirm}
                                disabled={isBulkDeleting || isBulkDeleteInfoLoading}
                                loading={isBulkDeleting || isBulkDeleteInfoLoading}
                                loadingText={isBulkDeleteInfoLoading ? "Checking warnings" : "Deleting categories"}
                            >
                                <Trash2Icon className="h-4 w-4" />
                                {isBulkDeleting ? "Deleting..." : "Delete Selected"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedCategoryIds(new Set())}
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
                    <div className="min-w-160">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox checked={false} disabled />
                                    </TableHead>
                                    {visibleColumns.name && <TableHead>Name</TableHead>}
                                    {visibleColumns.created && <TableHead>Created</TableHead>}
                                    {visibleColumns.actions && <TableHead>Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <TableRow key={`categories-loading-${index}`}>
                                        <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                                        {visibleColumns.name && <TableCell><Skeleton className="h-4 w-40" /></TableCell>}
                                        {visibleColumns.created && <TableCell><Skeleton className="h-4 w-24" /></TableCell>}
                                        {visibleColumns.actions && (
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Skeleton className="h-8 w-14 rounded-md" />
                                                    <Skeleton className="h-8 w-16 rounded-md" />
                                                </div>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            ) : categories.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                    No categories yet. Create your first category.
                </div>
            ) : (
                <div className="overflow-x-auto rounded-xl border">
                    <div className="min-w-160">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={isAllSelected}
                                            onCheckedChange={(value) => {
                                                if (value) {
                                                    setSelectedCategoryIds(new Set(sortedCategories.map((category) => category._id)))
                                                    return
                                                }

                                                setSelectedCategoryIds(new Set())
                                            }}
                                            title="Select all"
                                        />
                                    </TableHead>
                                    {visibleColumns.name && (
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
                                    )}
                                    {visibleColumns.created && (
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
                                    )}
                                    {visibleColumns.actions && <TableHead>Actions</TableHead>}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedCategories.length === 0 && categorySearch ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                                            No categories found matching your search.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedCategories.map((category) => (
                                        <TableRow
                                            key={category._id}
                                            className={selectedCategoryIds.has(category._id) ? "bg-primary/20 text-foreground hover:bg-primary/20" : "hover:bg-muted/40"}
                                        >
                                            <TableCell onClick={(event) => event.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedCategoryIds.has(category._id)}
                                                    onCheckedChange={(value) => {
                                                        const nextSelected = new Set(selectedCategoryIds)
                                                        if (value) {
                                                            nextSelected.add(category._id)
                                                        } else {
                                                            nextSelected.delete(category._id)
                                                        }
                                                        setSelectedCategoryIds(nextSelected)
                                                    }}
                                                    title={`Select ${category.name}`}
                                                />
                                            </TableCell>
                                            {visibleColumns.name && (
                                                <TableCell>
                                                    {editingId === category._id ? (
                                                        <Input
                                                            value={editingName || ""}
                                                            onChange={(event) => setEditingName(event.target.value)}
                                                        />
                                                    ) : (
                                                        <span className="block w-11/12 overflow-hidden text-ellipsis whitespace-nowrap" title={category.name}>
                                                            {category.name}
                                                        </span>
                                                    )}
                                                </TableCell>
                                            )}
                                            {visibleColumns.created && (
                                                <TableCell>{new Date(category.createdAt).toLocaleDateString()}</TableCell>
                                            )}
                                            {visibleColumns.actions && (
                                                <TableCell className="flex gap-2 justify-end">
                                                    {editingId === category._id ? (
                                                        <Button size="sm" onClick={saveEdit}>
                                                            Save
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => {
                                                                setEditingId(category._id)
                                                                setEditingName(category.name)
                                                                setErrors({})
                                                            }}
                                                        >
                                                            Edit
                                                        </Button>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() => {
                                                            setSelectedCategoryIds((current) => {
                                                                const next = new Set(current)
                                                                next.delete(category._id)
                                                                return next
                                                            })
                                                            void handleDeleteCategory(category)
                                                        }}
                                                    >
                                                        Delete
                                                    </Button>
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))
                                )}
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
                                <h2 className="text-lg font-semibold text-foreground">Delete Selected Categories?</h2>
                                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
                            </div>

                            {isBulkDeleteInfoLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                            ) : bulkDeleteWarningSummary.totalLinkedProducts > 0 ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <p className="text-sm font-semibold mb-2 text-amber-900 dark:text-amber-200">Warning</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-300">
                                        <li>
                                            <span className="font-medium">{bulkDeleteWarningSummary.categoriesWithProducts}</span>
                                            {" "}
                                            selected categor{bulkDeleteWarningSummary.categoriesWithProducts === 1 ? "y is" : "ies are"}
                                            {" "}
                                            used by products.
                                        </li>
                                        <li>
                                            <span className="font-medium">{bulkDeleteWarningSummary.totalLinkedProducts}</span>
                                            {" "}
                                            product{bulkDeleteWarningSummary.totalLinkedProducts === 1 ? "" : "s"}
                                            {" "}
                                            have category cleared.
                                        </li>
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
                                    onClick={removeSelectedCategories}
                                    disabled={isBulkDeleting || isBulkDeleteInfoLoading}
                                    loading={isBulkDeleting || isBulkDeleteInfoLoading}
                                    loadingText={isBulkDeleteInfoLoading ? "Checking warnings" : "Deleting categories"}
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
                                <h2 className="text-lg font-semibold text-foreground">Delete Category?</h2>
                                <p className="text-sm text-muted-foreground mt-1">This action cannot be undone.</p>
                            </div>

                            {isDeleteInfoLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="h-3 w-2/3" />
                                </div>
                            ) : deleteConfirmData.hasLinkedProducts ? (
                                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                    <p className="text-sm font-semibold mb-2 text-amber-900 dark:text-amber-200">Warning</p>
                                    <ul className="list-disc list-inside space-y-1 text-sm text-amber-800 dark:text-amber-300">
                                        <li>Category: <span className="font-medium">{deleteConfirmData.categoryName}</span></li>
                                        <li>Used by <span className="font-medium">{deleteConfirmData.productCount}</span> product{deleteConfirmData.productCount !== 1 ? "s" : ""}</li>
                                        <li>Products will remain, but their category assignment will be cleared.</li>
                                    </ul>
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
                                    onClick={confirmDeleteCategory}
                                    disabled={isDeleting || isDeleteInfoLoading}
                                    loading={isDeleting || isDeleteInfoLoading}
                                    loadingText={isDeleteInfoLoading ? "Checking warnings" : "Deleting category"}
                                >
                                    Delete Category
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    )
}
