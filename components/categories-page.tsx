"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { Trash2Icon } from "lucide-react"

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

    const isAllSelected = categories.length > 0 && selectedCategoryIds.size === categories.length

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="px-0">
                <CardTitle className="text-2xl font-bold">Categories</CardTitle>
                <CardDescription>Create, update, and delete categories.</CardDescription>
            </CardHeader>

            <section className="space-y-4">
                <form className="flex flex-col gap-2 sm:flex-row" onSubmit={createCategory}>
                    <Input
                        placeholder="Category name"
                        className="h-10 min-w-0 flex-1"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                    />
                    <Button type="submit" size={"lg"} className="h-10 px-6">Add</Button>
                </form>

                {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
                {errors.general ? <p className="text-sm text-destructive">{errors.general}</p> : null}

                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm text-muted-foreground">Total</h3>
                    <p className="text-sm font-semibold">{categories.length}</p>
                    {selectedCategoryIds.size > 0 ? (
                        <>
                            <span className="text-xs text-muted-foreground">|</span>
                            <p className="text-sm font-medium text-primary">{selectedCategoryIds.size} selected</p>
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
                                                    setSelectedCategoryIds(new Set(categories.map((category) => category._id)))
                                                    return
                                                }

                                                setSelectedCategoryIds(new Set())
                                            }}
                                            title="Select all"
                                        />
                                    </TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading
                                    ? Array.from({ length: 6 }).map((_, index) => (
                                        <TableRow key={`categories-loading-${index}`}>
                                            <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                            <TableCell>
                                                <div className="flex gap-2">
                                                    <Skeleton className="h-8 w-14 rounded-md" />
                                                    <Skeleton className="h-8 w-16 rounded-md" />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                    : categories.map((category) => (
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
                                            <TableCell>{new Date(category.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="flex gap-2">
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
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </section>
        </div>
    )
}
