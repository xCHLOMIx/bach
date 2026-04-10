"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
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
import { setIntendedSellingPrice } from "@/lib/intended-pricing"
import { ImagePlusIcon, PlusIcon, XIcon } from "lucide-react"

const SOURCE_CURRENCY_OPTIONS = ["USD", "RWF", "CNY", "AED"] as const
const NO_CATEGORY_VALUE = "__none__"

type AddProductSheetProps = {
    onProductCreated?: () => Promise<void> | void
    open?: boolean
    onOpenChange?: (open: boolean) => void
    triggerButton?: React.ReactNode
}

type Category = {
    _id: string
    name: string
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
        return items
    }

    const next = [...items]
    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
}

export function AddProductSheet({ onProductCreated, open, onOpenChange, triggerButton }: AddProductSheetProps) {
    const [internalOpen, setInternalOpen] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [categories, setCategories] = React.useState<Category[]>([])
    const [hasLoadedCategories, setHasLoadedCategories] = React.useState(false)

    const [name, setName] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("")
    const [isAddingCustomCategory, setIsAddingCustomCategory] = React.useState(false)
    const [customCategoryName, setCustomCategoryName] = React.useState("")
    const [quantityInitial, setQuantityInitial] = React.useState("")
    const [unitPriceForeign, setUnitPriceForeign] = React.useState("")
    const [intendedSellingPrice, setIntendedSellingPriceInput] = React.useState("")
    const [sourceCurrency, setSourceCurrency] = React.useState<(typeof SOURCE_CURRENCY_OPTIONS)[number]>("USD")
    const [exchangeRate, setExchangeRate] = React.useState("")
    const [externalLink, setExternalLink] = React.useState("")
    const [imageFiles, setImageFiles] = React.useState<File[]>([])
    const [draggedImageIndex, setDraggedImageIndex] = React.useState<number | null>(null)

    const isControlledOpen = typeof open === "boolean"
    const isOpen = isControlledOpen ? open : internalOpen

    const setIsOpen = React.useCallback((nextOpen: boolean) => {
        if (nextOpen === isOpen) {
            return
        }

        if (!isControlledOpen) {
            setInternalOpen(nextOpen)
        }
        onOpenChange?.(nextOpen)
    }, [isControlledOpen, isOpen, onOpenChange])

    const toIntegerInput = (value: string) => value.replace(/\D/g, "")
    const stripCommas = (value: string) => value.replace(/,/g, "")
    const toSelectedFiles = (event: React.ChangeEvent<HTMLInputElement>) => Array.from(event.target.files ?? [])

    const imagePreviews = React.useMemo(() => {
        const previews = imageFiles.map((file) => URL.createObjectURL(file))
        return previews
    }, [imageFiles])

    React.useEffect(() => {
        return () => {
            imagePreviews.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [imagePreviews])

    React.useEffect(() => {
        if (sourceCurrency === "RWF") {
            setExchangeRate("")
        }
    }, [sourceCurrency])

    React.useEffect(() => {
        if (!isOpen || hasLoadedCategories) {
            return
        }

        const loadCategories = async () => {
            const response = await fetch("/api/categories")
            if (!response.ok) {
                return
            }

            const data = await response.json()
            setCategories(data.categories ?? [])
            setHasLoadedCategories(true)
        }

        void loadCategories()
    }, [hasLoadedCategories, isOpen])

    const reorderImageFiles = React.useCallback((toIndex: number) => {
        setImageFiles((current) => {
            if (draggedImageIndex === null) {
                return current
            }

            return moveItem(current, draggedImageIndex, toIndex)
        })

        setDraggedImageIndex(null)
    }, [draggedImageIndex])

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

    const resetForm = () => {
        setName("")
        setCategoryId("")
        setIsAddingCustomCategory(false)
        setCustomCategoryName("")
        setQuantityInitial("")
        setUnitPriceForeign("")
        setIntendedSellingPriceInput("")
        setSourceCurrency("USD")
        setExchangeRate("")
        setExternalLink("")
        setImageFiles([])
        setErrors({})
    }

    const canSubmit =
        Boolean(name.trim()) &&
        Boolean(quantityInitial.trim()) &&
        Boolean(unitPriceForeign.trim()) &&
        (sourceCurrency === "RWF" || Boolean(exchangeRate.trim()))

    const submit = async () => {
        if (isSubmitting) {
            return
        }

        setIsSubmitting(true)
        setErrors({})

        try {
            let resolvedCategoryId = categoryId

            if (isAddingCustomCategory) {
                const customName = customCategoryName.trim()
                if (!customName) {
                    setErrors({ categoryId: "Category name is required" })
                    return
                }

                const existingCategory = categories.find(
                    (category) => category.name.trim().toLowerCase() === customName.toLowerCase()
                )

                if (existingCategory?._id) {
                    resolvedCategoryId = existingCategory._id
                } else {
                    const createCategoryResponse = await fetch("/api/categories", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: customName }),
                    })

                    const createCategoryData = await createCategoryResponse.json()
                    if (!createCategoryResponse.ok) {
                        setErrors(createCategoryData.errors ?? { categoryId: "Failed to create category" })
                        return
                    }

                    resolvedCategoryId = createCategoryData.category?._id ?? ""
                    if (createCategoryData.category?._id && createCategoryData.category?.name) {
                        setCategories((current) => [createCategoryData.category, ...current])
                    }
                }
            }

            const formData = new FormData()
            formData.append("name", name)
            if (resolvedCategoryId) {
                formData.append("categoryId", resolvedCategoryId)
            }
            formData.append("quantityInitial", quantityInitial)
            formData.append("unitPriceForeign", stripCommas(unitPriceForeign))
            formData.append("sourceCurrency", sourceCurrency)
            formData.append("exchangeRate", stripCommas(exchangeRate))
            formData.append("externalLink", externalLink)
            for (const file of imageFiles) {
                formData.append("images", file)
            }

            const response = await fetch("/api/products", {
                method: "POST",
                body: formData,
            })

            const data = await response.json()
            if (!response.ok) {
                setErrors(data.errors ?? { general: "Failed to create product" })
                return
            }

            const createdProductId = (data?.product as { _id?: string } | undefined)?._id
            if (createdProductId) {
                const parsedIntendedSellingPrice = Number(stripCommas(intendedSellingPrice) || 0)
                if (intendedSellingPrice.trim() && Number.isFinite(parsedIntendedSellingPrice) && parsedIntendedSellingPrice >= 0) {
                    setIntendedSellingPrice(createdProductId, parsedIntendedSellingPrice)
                }
            }

            resetForm()
            setIsOpen(false)
            await onProductCreated?.()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Sheet
            open={isOpen}
            onOpenChange={(nextOpen) => {
                if (isOpen && !nextOpen) {
                    resetForm()
                }
                setIsOpen(nextOpen)
            }}
        >
            <SheetTrigger asChild>
                {triggerButton ?? (
                    <Button type="button" size="sm" variant="outline">
                        <PlusIcon className="h-4 w-4" />
                        Add Product
                    </Button>
                )}
            </SheetTrigger>
            {isOpen ? (
                <SheetContent className="p-0">
                    <SheetHeader>
                        <SheetTitle>Add Product</SheetTitle>
                        <SheetDescription>Create a new product entry.</SheetDescription>
                    </SheetHeader>

                    <div className="grid gap-6 overflow-y-auto p-4">
                        <Field>
                            <div className="space-y-3 border-b pb-4">
                                <h3 className="text-sm font-semibold">Images</h3>

                                <div className="relative flex h-64 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 group">
                                    {imagePreviews[0] ? (
                                        <>
                                            <img
                                                src={imagePreviews[0]}
                                                alt="Main product image"
                                                className="h-full w-full object-cover"
                                                draggable
                                                onDragStart={() => setDraggedImageIndex(0)}
                                                onDragEnd={() => setDraggedImageIndex(null)}
                                                onDragOver={(event) => event.preventDefault()}
                                                onDrop={() => reorderImageFiles(0)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setImageFiles((current) => current.filter((_, index) => index !== 0))
                                                }}
                                                className="absolute right-2 top-2 rounded bg-red-500 p-2 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                            >
                                                <XIcon className="h-4 w-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 px-3 text-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-background/70 transition-colors group-hover:border-primary/50">
                                                <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <div className="text-sm font-medium text-foreground">Add main image</div>
                                            <div className="text-xs text-muted-foreground">Click to upload</div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(event) => {
                                                    const selectedFiles = toSelectedFiles(event)
                                                    if (selectedFiles.length > 0) {
                                                        setImageFiles((current) => [...selectedFiles, ...current])
                                                    }
                                                    event.currentTarget.value = ""
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>

                                {imageFiles.length > 0 ? (
                                    <div className="grid grid-cols-3 gap-2">
                                        {imagePreviews.slice(1).map((preview, index) => {
                                            const imageIndex = index + 1

                                            return (
                                                <div key={`new-${imageIndex}`} className="relative aspect-square overflow-hidden rounded-md border border-border bg-muted/30 group">
                                                    <img
                                                        src={preview}
                                                        alt={`New image ${imageIndex + 1}`}
                                                        className="h-full w-full object-cover"
                                                        draggable
                                                        onDragStart={() => setDraggedImageIndex(imageIndex)}
                                                        onDragEnd={() => setDraggedImageIndex(null)}
                                                        onDragOver={(event) => event.preventDefault()}
                                                        onDrop={() => reorderImageFiles(imageIndex)}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setImageFiles((current) => current.filter((_, currentIndex) => currentIndex !== imageIndex))
                                                        }}
                                                        className="absolute right-1 top-1 rounded bg-red-500 p-1 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                                                    >
                                                        <XIcon className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )
                                        })}

                                        <label className="group relative flex aspect-square cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border bg-muted/30 transition-colors hover:bg-muted/50">
                                            <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="hidden"
                                                onChange={(event) => {
                                                    const selectedFiles = toSelectedFiles(event)
                                                    if (selectedFiles.length > 0) {
                                                        setImageFiles((current) => [...current, ...selectedFiles])
                                                    }
                                                    event.currentTarget.value = ""
                                                }}
                                            />
                                        </label>
                                    </div>
                                ) : null}
                            </div>
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-name">Product name</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.name}</FieldError>
                            </div>
                            <Input
                                id="quick-product-name"
                                placeholder="Product name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-link">External link (optional)</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.externalLink}</FieldError>
                            </div>
                            <Input
                                id="quick-product-link"
                                type="url"
                                placeholder="https://example.com/product"
                                value={externalLink}
                                onChange={(event) => setExternalLink(event.target.value)}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-category">Category (optional)</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.categoryId}</FieldError>
                            </div>
                            {isAddingCustomCategory ? (
                                <div className="flex gap-2">
                                    <Input
                                        id="quick-product-category"
                                        placeholder="Type new category name"
                                        value={customCategoryName}
                                        onChange={(event) => setCustomCategoryName(event.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsAddingCustomCategory(false)
                                            setCustomCategoryName("")
                                            setCategoryId("")
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={categoryId || NO_CATEGORY_VALUE}
                                        onValueChange={(value) => {
                                            setIsAddingCustomCategory(false)
                                            setCustomCategoryName("")
                                            setCategoryId(value === NO_CATEGORY_VALUE ? "" : value)
                                        }}
                                    >
                                        <SelectTrigger id="quick-product-category" className="w-full">
                                            <SelectValue placeholder="Choose category (optional)" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NO_CATEGORY_VALUE}>No category</SelectItem>
                                            {categories.map((category) => (
                                                <SelectItem key={category._id} value={category._id}>
                                                    {category.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        type="button"
                                        size="sm"
                                        className="h-8 px-3"
                                        onClick={() => {
                                            setIsAddingCustomCategory(true)
                                            setCategoryId("")
                                        }}
                                    >
                                        Add category
                                    </Button>
                                </div>
                            )}
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-quantity">Initial stock</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.quantityInitial}</FieldError>
                            </div>
                            <Input
                                id="quick-product-quantity"
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="Enter initial stock"
                                value={quantityInitial}
                                onChange={(event) => setQuantityInitial(toIntegerInput(event.target.value))}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-unit-price">Unit price</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.unitPriceForeign}</FieldError>
                            </div>
                            <Input
                                id="quick-product-unit-price"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="Enter unit price"
                                value={unitPriceForeign}
                                onChange={(event) => setUnitPriceForeign(toDecimalInput(event.target.value))}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-selling-price">Selling price (RWF, optional)</FieldLabel>
                            </div>
                            <Input
                                id="quick-product-selling-price"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="Enter target selling price"
                                value={intendedSellingPrice}
                                onChange={(event) => setIntendedSellingPriceInput(toDecimalInput(event.target.value))}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-currency">Source currency</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.sourceCurrency}</FieldError>
                            </div>
                            <Select value={sourceCurrency} onValueChange={(value) => setSourceCurrency(value as (typeof SOURCE_CURRENCY_OPTIONS)[number])}>
                                <SelectTrigger id="quick-product-currency">
                                    <SelectValue placeholder="Choose source currency" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SOURCE_CURRENCY_OPTIONS.map((currency) => (
                                        <SelectItem key={currency} value={currency}>
                                            {currency}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="quick-product-exchange-rate">Exchange rate to RWF</FieldLabel>
                                <FieldError className="text-xs text-destructive">{errors.exchangeRate}</FieldError>
                            </div>
                            <Input
                                id="quick-product-exchange-rate"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder={sourceCurrency === "RWF" ? "Auto-set to 1 for RWF" : "Enter exchange rate to RWF"}
                                value={exchangeRate}
                                disabled={sourceCurrency === "RWF"}
                                onChange={(event) => setExchangeRate(toDecimalInput(event.target.value))}
                            />
                        </Field>

                        {errors.general ? <FieldError className="text-xs text-destructive">{errors.general}</FieldError> : null}

                        <div className="flex items-center justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                disabled={!canSubmit || isSubmitting}
                                onClick={() => void submit()}
                                loading={isSubmitting}
                                loadingText="Adding product"
                            >
                                Add Product
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            ) : null}
        </Sheet>
    )
}
