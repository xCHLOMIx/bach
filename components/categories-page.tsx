"use client"

import * as React from "react"

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

    const removeCategory = async (id: string) => {
        const response = await fetch(`/api/categories/${id}`, {
            method: "DELETE",
        })

        if (!response.ok) return
        await load()
    }

    const removeSelectedCategories = async () => {
        if (selectedCategoryIds.size === 0) {
            return
        }

        setErrors({})
        setIsBulkDeleting(true)

        try {
            const failedIds: string[] = []

            for (const categoryId of selectedCategoryIds) {
                const response = await fetch(`/api/categories/${categoryId}`, {
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
            await load()
        } finally {
            setIsBulkDeleting(false)
        }
    }

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
                <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={createCategory}>
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
                                onClick={removeSelectedCategories}
                                disabled={isBulkDeleting}
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
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            disabled
                                        />
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
                                        <input
                                            type="checkbox"
                                            className="rounded"
                                            checked={isAllSelected}
                                            onChange={(event) => {
                                                if (event.target.checked) {
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
                                            className={selectedCategoryIds.has(category._id) ? "bg-primary/20 text-foreground" : "hover:bg-muted/40"}
                                        >
                                            <TableCell onClick={(event) => event.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    className="rounded"
                                                    checked={selectedCategoryIds.has(category._id)}
                                                    onChange={(event) => {
                                                        const nextSelected = new Set(selectedCategoryIds)
                                                        if (event.target.checked) {
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
                                                            value={editingName}
                                                            onChange={(event) => setEditingName(event.target.value)}
                                                        />
                                                    ) : (
                                                        category.name
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
                                                            void removeCategory(category._id)
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
        </div>
    )
}
