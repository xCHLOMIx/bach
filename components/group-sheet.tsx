"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ProductSheetFrame } from "@/components/product-sheet-frame"
import { formatRWF } from "@/lib/utils"
import { toast } from "sonner"

type GroupProduct = {
    _id: string
    name: string
    quantityRemaining: number
    purchasePriceRWF: number
    landedCost: number
    intendedSellingPrice?: number | null
    batchId?: { batchName?: string } | null
}

type GroupSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    products: GroupProduct[]
    group?: {
        _id: string
        name: string
        productIds: string[]
    } | null
    onSaved?: () => Promise<void> | void
}

function formatTotal(value: number) {
    return `${formatRWF(value)} RWF`
}

export function GroupSheet({ open, onOpenChange, products, group, onSaved }: GroupSheetProps) {
    const [name, setName] = React.useState("")
    const [search, setSearch] = React.useState("")
    const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set())
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = React.useState(false)

    React.useEffect(() => {
        if (!open) {
            return
        }

        setName(group?.name ?? "")
        setSearch("")
        setSelectedProductIds(new Set(group?.productIds ?? []))
        setErrors({})
    }, [group, open])

    const visibleProducts = React.useMemo(() => {
        const query = search.trim().toLowerCase()
        return products.filter((product) => {
            if (!query) return true
            return [product.name, product.batchId?.batchName ?? ""].join(" ").toLowerCase().includes(query)
        })
    }, [products, search])

    const selectedCount = selectedProductIds.size

    const toggleProduct = React.useCallback((productId: string) => {
        setSelectedProductIds((current) => {
            const next = new Set(current)
            if (next.has(productId)) {
                next.delete(productId)
            } else {
                next.add(productId)
            }
            return next
        })
    }, [])

    const submit = async () => {
        if (isSaving) return

        const nextErrors: Record<string, string> = {}
        if (!name.trim()) nextErrors.name = "Group name is required"
        if (selectedProductIds.size === 0) nextErrors.productIds = "Select at least one product"

        if (Object.keys(nextErrors).length > 0) {
            setErrors(nextErrors)
            return
        }

        setIsSaving(true)
        setErrors({})

        try {
            const response = await fetch(group ? `/api/groups/${group._id}` : "/api/groups", {
                method: group ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    productIds: Array.from(selectedProductIds),
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                setErrors(data.errors ?? { general: "Failed to save group" })
                toast.error(data.errors?.general ?? "Failed to save group")
                return
            }

            toast.success(group ? "Group updated" : "Group created")
            onOpenChange(false)
            await onSaved?.()
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <ProductSheetFrame
            open={open}
            onOpenChange={onOpenChange}
            title={group ? <span className="truncate">Edit {group.name}</span> : "Create Group"}
            description="Group products together and keep grouped inventory in one place."
            contentClassName="overflow-y-auto"
        >
            <div className="grid gap-6">
                <div className="grid gap-4 mx-4 rounded-xl border p-4">
                    <Field>
                        <div className="flex items-center justify-between">
                            <FieldLabel htmlFor="group-name">Group name</FieldLabel>
                            <FieldError className="text-xs text-destructive">{errors.name}</FieldError>
                        </div>
                        <Input
                            id="group-name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Enter group name"
                        />
                    </Field>

                    <Field>
                        <div className="flex items-center justify-between gap-2">
                            <FieldLabel htmlFor="group-search">Products</FieldLabel>
                            <FieldError className="text-xs text-destructive">{errors.productIds}</FieldError>
                        </div>
                        <Input
                            id="group-search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search products"
                        />
                    </Field>

                    <div className="rounded-lg border bg-background">
                        <div className="max-h-[52vh] overflow-y-auto">
                            {visibleProducts.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {visibleProducts.map((product) => {
                                        const isSelected = selectedProductIds.has(product._id)
                                        const quantity = Math.max(0, product.quantityRemaining ?? 0)
                                        const groupValue = (product.purchasePriceRWF ?? 0) * quantity

                                        return (
                                            <label
                                                key={product._id}
                                                className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-muted/40"
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleProduct(product._id)}
                                                    className="mt-0.5"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-col items-start gap-3">
                                                        <div className="min-w-0 max-w-45">
                                                            <div className="truncate font-medium">{product.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {product.batchId?.batchName ?? "No batch"} · Qty {quantity.toLocaleString()}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs self-end text-muted-foreground">
                                                            {formatTotal(groupValue)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </label>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                                    No products match your search.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="text-xs text-muted-foreground">
                        Selected {selectedCount} product{selectedCount === 1 ? "" : "s"}
                    </div>
                </div>

                {errors.general ? <p className="mx-4 text-sm text-destructive">{errors.general}</p> : null}

                <div className="sticky bottom-0 left-0 right-0 z-20 border-t border-border bg-card/90 p-4 backdrop-blur-sm">
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void submit()} loading={isSaving} loadingText={group ? "Saving group" : "Creating group"}>
                            {group ? "Save group" : "Create group"}
                        </Button>
                    </div>
                </div>
            </div>
        </ProductSheetFrame>
    )
}