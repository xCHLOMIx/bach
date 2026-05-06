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
        productQuantities?: Record<string, number>
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
    const [selectedQuantities, setSelectedQuantities] = React.useState<Record<string, number>>({})
    const [selectedQuantityInputs, setSelectedQuantityInputs] = React.useState<Record<string, string>>({})
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSaving, setIsSaving] = React.useState(false)

    React.useEffect(() => {
        if (!open) {
            return
        }

        setName(group?.name ?? "")
        setSearch("")
        const nextSelectedIds = new Set(group?.productIds ?? [])
        const nextQuantities: Record<string, number> = {}

        const nextQuantityInputs: Record<string, string> = {}
        for (const product of products) {
            if (!nextSelectedIds.has(product._id)) {
                continue
            }

            const maxQuantity = Math.max(0, product.quantityRemaining ?? 0)
            const savedQuantity = group?.productQuantities?.[product._id]
            const baseQuantity = typeof savedQuantity === "number" ? savedQuantity : 1
            nextQuantities[product._id] = maxQuantity > 0 ? Math.min(maxQuantity, Math.max(1, Math.floor(baseQuantity))) : 0
            nextQuantityInputs[product._id] = String(nextQuantities[product._id])
        }

        setSelectedProductIds(nextSelectedIds)
        setSelectedQuantities(nextQuantities)
        setSelectedQuantityInputs(nextQuantityInputs)
        setErrors({})
    }, [group, open, products])

    const visibleProducts = React.useMemo(() => {
        const query = search.trim().toLowerCase()
        return products.filter((product) => {
            if (!query) return true
            return [product.name, product.batchId?.batchName ?? ""].join(" ").toLowerCase().includes(query)
        })
    }, [products, search])

    const selectedCount = selectedProductIds.size

    const toggleProduct = React.useCallback((productId: string, maxQuantity: number) => {
        setSelectedProductIds((current) => {
            const next = new Set(current)
            if (next.has(productId)) {
                next.delete(productId)
                setSelectedQuantities((currentQuantities) => {
                    const nextQuantities = { ...currentQuantities }
                    delete nextQuantities[productId]
                    return nextQuantities
                })
                setSelectedQuantityInputs((current) => {
                    const next = { ...current }
                    delete next[productId]
                    return next
                })
            } else {
                next.add(productId)
                setSelectedQuantities((currentQuantities) => ({
                    ...currentQuantities,
                    [productId]: maxQuantity > 0 ? Math.min(maxQuantity, Math.max(1, Math.floor(currentQuantities[productId] ?? 1))) : 0,
                }))
                setSelectedQuantityInputs((current) => ({
                    ...current,
                    [productId]: String(current[productId] ?? 1),
                }))
            }
            return next
        })
    }, [])

    const updateQuantity = React.useCallback((productId: string, nextQuantity: number, maxQuantity: number) => {
        setSelectedQuantities((current) => ({
            ...current,
            [productId]: maxQuantity > 0 ? Math.min(maxQuantity, Math.max(1, Math.floor(nextQuantity))) : 0,
        }))
        setSelectedQuantityInputs((current) => ({
            ...current,
            [productId]: String(maxQuantity > 0 ? Math.min(maxQuantity, Math.max(1, Math.floor(nextQuantity))) : 0),
        }))
    }, [])

    const submit = async () => {
        if (isSaving) return

        const nextErrors: Record<string, string> = {}
        if (!name.trim()) nextErrors.name = "Group name is required"
        if (selectedProductIds.size === 0) nextErrors.productIds = "Select at least one product"

        const selectedItems = Array.from(selectedProductIds).map((productId) => {
            const product = products.find((entry) => entry._id === productId)
            const maxQuantity = Math.max(0, product?.quantityRemaining ?? 0)
            const quantity = Math.floor(selectedQuantities[productId] ?? 0)
            return { productId, quantity, maxQuantity }
        })

        if (selectedItems.some((item) => item.quantity <= 0 || item.quantity > item.maxQuantity)) {
            nextErrors.productIds = "Adjust selected quantities to match available stock"
        }

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
                    productIds: selectedItems.map((item) => item.productId),
                    items: selectedItems.map((item) => ({ productId: item.productId, quantity: item.quantity })),
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
                <div className="grid gap-4 p-4">
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
                            className="rounded-none"
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search products"
                        />
                    </Field>

                    <div className="border bg-background w-full">
                        <div className="max-h-[52vh] overflow-y-auto">
                            {visibleProducts.length > 0 ? (
                                <div className="divide-y divide-border">
                                    {visibleProducts.map((product) => {
                                        const isSelected = selectedProductIds.has(product._id)
                                        const availableQuantity = Math.max(0, product.quantityRemaining ?? 0)
                                        const selectedQuantity = selectedQuantities[product._id] ?? 1
                                        const quantity = Math.min(availableQuantity, Math.max(0, selectedQuantity))
                                        const groupValue = (product.purchasePriceRWF ?? 0) * quantity

                                        return (
                                            <label
                                                key={product._id}
                                                className="flex cursor-pointer items-start gap-3 px-3 py-3 hover:bg-muted/40"
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    onCheckedChange={() => toggleProduct(product._id, availableQuantity)}
                                                    className="mt-0.5"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-col items-start justify-between">
                                                        <div className="min-w-0 max-w-45">
                                                            <div className="truncate font-medium">{product.name}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {product.batchId?.batchName ?? "No batch"} · Qty {availableQuantity.toLocaleString()}
                                                            </div>
                                                        </div>

                                                        <div className="flex shrink-0 self-end flex-col items-end gap-1.5">
                                                            <div className="text-xs text-muted-foreground">{formatTotal(groupValue)}</div>
                                                            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-1 py-1">
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-sm leading-none text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                                                    disabled={!isSelected || quantity <= 1}
                                                                    onClick={(event) => {
                                                                        event.preventDefault()
                                                                        updateQuantity(product._id, quantity - 1, availableQuantity)
                                                                    }}
                                                                >
                                                                    -
                                                                </button>
                                                                <div className="max-w-10">
                                                                    <input
                                                                        type="text"
                                                                        inputMode="numeric"
                                                                        value={selectedQuantityInputs[product._id] ?? String(quantity)}
                                                                        disabled={!isSelected}
                                                                        onChange={(e) => {
                                                                            const raw = e.target.value
                                                                            // allow clearing the input while typing
                                                                            if (raw.trim() === "") {
                                                                                setSelectedQuantityInputs((current) => ({ ...current, [product._id]: "" }))
                                                                                setSelectedQuantities((current) => ({ ...current, [product._id]: 0 }))
                                                                                return
                                                                            }

                                                                            const parsed = Number(raw.replace(/,/g, ""))
                                                                            if (Number.isNaN(parsed)) {
                                                                                // keep raw input if non-numeric chars present
                                                                                setSelectedQuantityInputs((current) => ({ ...current, [product._id]: raw }))
                                                                                return
                                                                            }

                                                                            let next = Math.floor(parsed)
                                                                            if (next < 1) next = 1
                                                                            if (next > availableQuantity) next = availableQuantity

                                                                            setSelectedQuantityInputs((current) => ({ ...current, [product._id]: String(next) }))
                                                                            setSelectedQuantities((current) => ({ ...current, [product._id]: next }))
                                                                        }}
                                                                        // commit on blur/Enter but change already happens on input
                                                                        onBlur={(e) => {
                                                                            const v = (e.target as HTMLInputElement).value.trim()
                                                                            if (v === "") {
                                                                                updateQuantity(product._id, 1, availableQuantity)
                                                                                return
                                                                            }
                                                                            const parsed = Number(v.replace(/,/g, ""))
                                                                            if (Number.isNaN(parsed) || parsed < 1) {
                                                                                updateQuantity(product._id, 1, availableQuantity)
                                                                                return
                                                                            }
                                                                            updateQuantity(product._id, parsed, availableQuantity)
                                                                        }}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === "Enter") {
                                                                                const v = (e.target as HTMLInputElement).value.trim()
                                                                                const parsed = Number(v.replace(/,/g, ""))
                                                                                if (v === "" || Number.isNaN(parsed) || parsed < 1) {
                                                                                    updateQuantity(product._id, 1, availableQuantity)
                                                                                } else {
                                                                                    updateQuantity(product._id, parsed, availableQuantity)
                                                                                }
                                                                            }
                                                                        }}
                                                                        className="w-full rounded-md border border-border py-0.5 text-center text-sm font-medium tabular-nums bg-transparent outline-none"
                                                                    />
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-sm leading-none text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                                                                    disabled={!isSelected || quantity >= availableQuantity}
                                                                    onClick={(event) => {
                                                                        event.preventDefault()
                                                                        updateQuantity(product._id, quantity + 1, availableQuantity)
                                                                    }}
                                                                >
                                                                    +
                                                                </button>
                                                            </div>
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
                        <Button
                            type="button"
                            onClick={() => void submit()}
                            loading={isSaving}
                            loadingText={group ? "Saving group" : "Creating group"}
                            disabled={isSaving || !name.trim() || selectedProductIds.size < 1}
                        >
                            {group ? "Save group" : "Create group"}
                        </Button>
                    </div>
                </div>
            </div>
        </ProductSheetFrame>
    )
}