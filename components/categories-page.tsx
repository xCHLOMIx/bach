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

type Category = {
    _id: string
    name: string
    createdAt: string
}

export function CategoriesPage() {
    const [categories, setCategories] = React.useState<Category[]>([])
    const [newName, setNewName] = React.useState("")
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [editingId, setEditingId] = React.useState("")
    const [editingName, setEditingName] = React.useState("")

    const load = React.useCallback(async () => {
        const response = await fetch("/api/categories")
        if (!response.ok) return
        const data = await response.json()
        setCategories(data.categories ?? [])
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

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="px-0">
                <CardTitle className="text-2xl font-bold">Categories</CardTitle>
                <CardDescription>Create, update, and delete categories.</CardDescription>
            </CardHeader>

            <section className="space-y-4">
                <form className="flex gap-2" onSubmit={createCategory}>
                    <Input
                        placeholder="Category name"
                        className="h-10"
                        value={newName}
                        onChange={(event) => setNewName(event.target.value)}
                    />
                    <Button type="submit" size={"lg"} className="px-6 h-10">Add</Button>
                </form>

                {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
                {errors.general ? <p className="text-sm text-destructive">{errors.general}</p> : null}

                <div className="overflow-hidden rounded-xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.map((category) => (
                                <TableRow key={category._id}>
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
                                            onClick={() => removeCategory(category._id)}
                                        >
                                            Delete
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    )
}
