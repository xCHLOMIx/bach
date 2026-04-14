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
import { ProductSheetFrame } from "@/components/product-sheet-frame"
import { XIcon, ImagePlusIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { toast } from "sonner"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"

const SOURCE_CURRENCY_OPTIONS = ["USD", "RWF", "CNY", "AED"]
const NO_CATEGORY_VALUE = "__none__"

type Category = { _id: string; name: string }
type Batch = { _id: string; batchName: string }

type Product = {
    _id: string
    name: string
    categoryId?: { _id?: string; name?: string }
    batchId?: { _id?: string; batchName?: string } | null
    quantityInitial: number
    unitPriceForeign: number
    sourceCurrency: string
    exchangeRate?: number
    externalLink?: string
    images: string[]
    intendedSellingPrice?: number | null
}

type EditImageItem = {
    id: string
    type: "existing" | "new"
    src: string
    file?: File
}

type ProductEditSheetProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    categories: Category[]
    batches: Batch[]
    onSaved?: () => Promise<void> | void
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

export function ProductEditSheet({
    open,
    onOpenChange,
    product,
    categories,
    batches,
    onSaved,
}: ProductEditSheetProps) {
    const [editProductName, setEditProductName] = React.useState("")
    const [editCategoryId, setEditCategoryId] = React.useState("")
    const [isAddingEditCustomCategory, setIsAddingEditCustomCategory] = React.useState(false)
    const [editCustomCategoryName, setEditCustomCategoryName] = React.useState("")
    const [editQuantityInitial, setEditQuantityInitial] = React.useState("")
    const [editUnitPriceForeign, setEditUnitPriceForeign] = React.useState("")
    const [editIntendedSellingPrice, setEditIntendedSellingPrice] = React.useState("")
    const [editExternalLink, setEditExternalLink] = React.useState("")
    const [editSourceCurrency, setEditSourceCurrency] = React.useState("USD")
    const [editExchangeRate, setEditExchangeRate] = React.useState("")
    const [editBatchId, setEditBatchId] = React.useState("")
    const [editImages, setEditImages] = React.useState<EditImageItem[]>([])
    const [draggedEditImageId, setDraggedEditImageId] = React.useState<string | null>(null)
    const [editErrors, setEditErrors] = React.useState<Record<string, string>>({})
    const [isEditSubmitting, setIsEditSubmitting] = React.useState(false)

    const [previewImages, setPreviewImages] = React.useState<string[]>([])
    const [previewImageIndex, setPreviewImageIndex] = React.useState(0)
    const previewImageSrc = previewImages[previewImageIndex] ?? null
    const isPreviewOpen = previewImages.length > 0

    const editGeneratedObjectUrlsRef = React.useRef<string[]>([])

    const stripCommas = (value: string) => value.replace(/,/g, "")
    const toIntegerInput = (value: string) => value.replace(/\D/g, "")

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

    const canSubmitEditProduct =
        Boolean(editProductName.trim()) &&
        Boolean(editQuantityInitial.trim()) &&
        Boolean(editUnitPriceForeign.trim()) &&
        (editSourceCurrency === "RWF" || Boolean(editExchangeRate.trim()))

    const clearEditImages = React.useCallback(() => {
        editGeneratedObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
        editGeneratedObjectUrlsRef.current = []
        setEditImages([])
    }, [])

    const removeEditImage = React.useCallback((imageId: string) => {
        setEditImages((current) => {
            const target = current.find((item) => item.id === imageId)
            if (target?.type === "new") {
                URL.revokeObjectURL(target.src)
                editGeneratedObjectUrlsRef.current = editGeneratedObjectUrlsRef.current.filter((url) => url !== target.src)
            }

            return current.filter((item) => item.id !== imageId)
        })
    }, [])

    const reorderEditImages = React.useCallback((targetId: string) => {
        if (!draggedEditImageId || draggedEditImageId === targetId) {
            return
        }

        setEditImages((current) => {
            const fromIndex = current.findIndex((item) => item.id === draggedEditImageId)
            const toIndex = current.findIndex((item) => item.id === targetId)
            return moveItem(current, fromIndex, toIndex)
        })

        setDraggedEditImageId(null)
    }, [draggedEditImageId])

    const openImagePreview = React.useCallback((images: string[], index: number) => {
        if (images.length === 0) {
            return
        }

        const safeIndex = Math.max(0, Math.min(index, images.length - 1))
        setPreviewImages(images)
        setPreviewImageIndex(safeIndex)
    }, [])

    const closeImagePreview = React.useCallback(() => {
        setPreviewImages([])
        setPreviewImageIndex(0)
    }, [])

    const showPreviousPreviewImage = React.useCallback(() => {
        if (previewImages.length < 2) {
            return
        }

        setPreviewImageIndex((current) => (current === 0 ? previewImages.length - 1 : current - 1))
    }, [previewImages.length])

    const showNextPreviewImage = React.useCallback(() => {
        if (previewImages.length < 2) {
            return
        }

        setPreviewImageIndex((current) => (current === previewImages.length - 1 ? 0 : current + 1))
    }, [previewImages.length])

    const hasEditProductChanges = React.useMemo(() => {
        if (!product) {
            return false
        }

        const parsedEditQuantity = Number(stripCommas(editQuantityInitial) || 0)
        const parsedEditUnitPrice = Number(stripCommas(editUnitPriceForeign) || 0)
        const parsedEditExchangeRate = Number(stripCommas(editExchangeRate || "1") || 1)
        const parsedOriginalExchangeRate = Number(product.exchangeRate ?? 1)

        const parsedEditSellingPrice = editIntendedSellingPrice.trim()
            ? Number(stripCommas(editIntendedSellingPrice))
            : null
        const parsedOriginalSellingPrice = product?.intendedSellingPrice ?? undefined
        const sellingPriceChanged = parsedEditSellingPrice === null
            ? typeof parsedOriginalSellingPrice === "number"
            : parsedEditSellingPrice !== parsedOriginalSellingPrice

        const existingImageSources = editImages
            .filter((image) => image.type === "existing")
            .map((image) => image.src)
        const originalImageSources = product.images ?? []
        const hasNewImages = editImages.some((image) => image.type === "new")
        const existingImagesChanged =
            existingImageSources.length !== originalImageSources.length ||
            existingImageSources.some((src, index) => src !== originalImageSources[index])

        return (
            editProductName.trim() !== product.name.trim() ||
            (editCategoryId || "") !== (product.categoryId?._id ?? "") ||
            parsedEditQuantity !== Number(product.quantityInitial ?? 0) ||
            parsedEditUnitPrice !== Number(product.unitPriceForeign ?? 0) ||
            editExternalLink.trim() !== (product.externalLink ?? "").trim() ||
            editSourceCurrency !== product.sourceCurrency ||
            (editSourceCurrency === "RWF" ? 1 : parsedEditExchangeRate) !== parsedOriginalExchangeRate ||
            (editBatchId || "") !== (product.batchId?._id ?? "") ||
            sellingPriceChanged ||
            hasNewImages ||
            existingImagesChanged
        )
    }, [
        editBatchId,
        editCategoryId,
        editExchangeRate,
        editExternalLink,
        editImages,
        editIntendedSellingPrice,
        editProductName,
        editQuantityInitial,
        editSourceCurrency,
        editUnitPriceForeign,
        product,
    ])

    React.useEffect(() => {
        if (!open || !product) {
            return
        }

        clearEditImages()
        setEditProductName(product.name)
        setEditCategoryId(product.categoryId?._id ?? "")
        setIsAddingEditCustomCategory(false)
        setEditCustomCategoryName("")
        setEditQuantityInitial(String(product.quantityInitial))
        setEditUnitPriceForeign(formatDecimalWithCommas(String(product.unitPriceForeign)))
        setEditIntendedSellingPrice(formatDecimalWithCommas(String(product.intendedSellingPrice ?? "")))
        setEditExternalLink(product.externalLink ?? "")
        setEditSourceCurrency(product.sourceCurrency)
        setEditExchangeRate(formatDecimalWithCommas(String(product.exchangeRate ?? 1)))
        setEditBatchId(product.batchId?._id ?? "")
        setEditImages((product.images ?? []).map((image, index) => ({
            id: `existing-${index}-${image}`,
            type: "existing",
            src: image,
        })))
        setEditErrors({})
    }, [open, product, clearEditImages])

    React.useEffect(() => {
        if (editSourceCurrency === "RWF") {
            setEditExchangeRate("1")
        }
    }, [editSourceCurrency])

    React.useEffect(() => {
        return () => {
            editGeneratedObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
            editGeneratedObjectUrlsRef.current = []
        }
    }, [])

    React.useEffect(() => {
        if (!isPreviewOpen) {
            return
        }

        const handlePreviewKeyboardControls = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault()
                closeImagePreview()
                return
            }

            if (event.key === "ArrowLeft") {
                event.preventDefault()
                showPreviousPreviewImage()
                return
            }

            if (event.key === "ArrowRight") {
                event.preventDefault()
                showNextPreviewImage()
            }
        }

        window.addEventListener("keydown", handlePreviewKeyboardControls)
        return () => window.removeEventListener("keydown", handlePreviewKeyboardControls)
    }, [closeImagePreview, isPreviewOpen, showNextPreviewImage, showPreviousPreviewImage])

    const submitEditProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!product) {
            return
        }

        setEditErrors({})
        setIsEditSubmitting(true)

        try {
            let resolvedCategoryId = editCategoryId

            if (isAddingEditCustomCategory) {
                const customName = editCustomCategoryName.trim()
                if (!customName) {
                    setEditErrors({ categoryId: "Category name is required" })
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
                        setEditErrors(createCategoryData.errors ?? { categoryId: "Failed to create category" })
                        return
                    }

                    resolvedCategoryId = createCategoryData.category?._id ?? ""
                }
            }

            const formData = new FormData()
            formData.append("name", editProductName)
            formData.append("categoryId", resolvedCategoryId || "")
            formData.append("quantityInitial", editQuantityInitial)
            formData.append("unitPriceForeign", stripCommas(editUnitPriceForeign))
            formData.append("externalLink", editExternalLink)
            formData.append("sourceCurrency", editSourceCurrency)
            formData.append("exchangeRate", stripCommas(editExchangeRate))
            formData.append("batchId", editBatchId || "")
            formData.append("intendedSellingPrice", stripCommas(editIntendedSellingPrice))
            formData.append("imagesTouched", "1")

            let existingCount = 0
            let newCount = 0

            editImages.forEach((image) => {
                if (image.type === "existing") {
                    formData.append("existingImages", image.src)
                    formData.append("imageOrder", `existing:${existingCount}`)
                    existingCount += 1
                    return
                }

                if (image.file) {
                    formData.append("newImages", image.file)
                    formData.append("imageOrder", `new:${newCount}`)
                    newCount += 1
                }
            })

            const response = await fetch(`/api/products/${product._id}`, {
                method: "PATCH",
                body: formData,
            })

            const data = await response.json()
            if (!response.ok) {
                setEditErrors(data.errors ?? { general: "Failed to update product" })
                return
            }

            toast.success("Product updated")
            onOpenChange(false)
            await onSaved?.()
        } finally {
            setIsEditSubmitting(false)
        }
    }

    return (
        <>
            <ProductSheetFrame
                open={open && Boolean(product)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen && isPreviewOpen) {
                        return
                    }

                    onOpenChange(nextOpen)
                }}
                title={<span className="truncate">Edit {product?.name || "Product"}</span>}
                description="Update product details and batch assignment."
                contentClassName="overflow-y-auto"
                onInteractOutside={(event) => {
                    if (isPreviewOpen) {
                        const target = event.target
                        if (!(target instanceof Element) || !target.closest('[data-image-preview="true"]')) {
                            event.preventDefault()
                        }
                    }
                }}
                onEscapeKeyDown={(event) => {
                    if (isPreviewOpen) {
                        event.preventDefault()
                    }
                }}
            >
                <form className="grid gap-6 p-4" onSubmit={submitEditProduct} onKeyDown={preventImplicitSubmitOnEnter}>
                    <div className="space-y-3 border-b pb-4">
                        <h3 className="font-semibold text-sm">Images</h3>

                        <div className="relative h-64 w-full overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center group">
                            {editImages[0] ? (
                                <>
                                    <img
                                        src={editImages[0].src}
                                        alt="Main product image"
                                        className="h-full w-full cursor-pointer object-cover"
                                        draggable
                                        loading="lazy"
                                        onDragStart={() => setDraggedEditImageId(editImages[0].id)}
                                        onDragEnd={() => setDraggedEditImageId(null)}
                                        onDragOver={(event) => event.preventDefault()}
                                        onDrop={() => reorderEditImages(editImages[0].id)}
                                        onClick={() => openImagePreview(editImages.map((image) => image.src), 0)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeEditImage(editImages[0].id)}
                                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                </>
                            ) : (
                                <label className="cursor-pointer flex flex-col items-center gap-2 px-3 text-center w-full h-full justify-center">
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
                                            const selectedFiles = Array.from(event.target.files ?? [])
                                            if (selectedFiles.length > 0) {
                                                const nextImages = selectedFiles.map((file, index) => {
                                                    const src = URL.createObjectURL(file)
                                                    editGeneratedObjectUrlsRef.current.push(src)

                                                    return {
                                                        id: `new-${Date.now()}-${index}-${file.name}`,
                                                        type: "new" as const,
                                                        src,
                                                        file,
                                                    }
                                                })

                                                setEditImages((current) => [
                                                    ...nextImages,
                                                    ...current,
                                                ])
                                            }

                                            event.currentTarget.value = ""
                                        }}
                                    />
                                </label>
                            )}
                        </div>

                        {editImages.length > 0 && (
                            <div className="grid grid-cols-3 gap-2">
                                {editImages.slice(1).map((image, index) => {
                                    const imageIndex = index + 1
                                    return (
                                        <div key={image.id} className="relative aspect-square rounded-md border border-border overflow-hidden group bg-muted/30">
                                            <img
                                                src={image.src}
                                                alt={`Product image ${imageIndex + 1}`}
                                                className="w-full h-full cursor-pointer object-cover"
                                                draggable
                                                loading="lazy"
                                                onDragStart={() => setDraggedEditImageId(image.id)}
                                                onDragEnd={() => setDraggedEditImageId(null)}
                                                onDragOver={(event) => event.preventDefault()}
                                                onDrop={() => reorderEditImages(image.id)}
                                                onClick={() => openImagePreview(editImages.map((entry) => entry.src), imageIndex)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => removeEditImage(image.id)}
                                                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <XIcon className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )
                                })}

                                <label className="relative aspect-square rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors group">
                                    <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                    <input
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={(event) => {
                                            const selectedFiles = Array.from(event.target.files ?? [])
                                            if (selectedFiles.length > 0) {
                                                const nextImages = selectedFiles.map((file, index) => {
                                                    const src = URL.createObjectURL(file)
                                                    editGeneratedObjectUrlsRef.current.push(src)

                                                    return {
                                                        id: `new-${Date.now()}-${index}-${file.name}`,
                                                        type: "new" as const,
                                                        src,
                                                        file,
                                                    }
                                                })

                                                setEditImages((current) => [
                                                    ...current,
                                                    ...nextImages,
                                                ])
                                            }

                                            event.currentTarget.value = ""
                                        }}
                                    />
                                </label>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 border-b pb-4">
                        <h3 className="font-semibold text-sm">Product Details</h3>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-name">Product name</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.name}</FieldError>
                            </div>
                            <Input
                                id="edit-name"
                                placeholder="Product name"
                                value={editProductName}
                                onChange={(event) => setEditProductName(event.target.value)}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-external-link">External link (optional)</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.externalLink}</FieldError>
                            </div>
                            <Input
                                id="edit-external-link"
                                type="url"
                                placeholder="https://example.com/product"
                                value={editExternalLink}
                                onChange={(event) => setEditExternalLink(event.target.value)}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-category">Category (optional)</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.categoryId}</FieldError>
                            </div>
                            {isAddingEditCustomCategory ? (
                                <div className="flex gap-2">
                                    <Input
                                        id="edit-category"
                                        placeholder="Type new category name"
                                        value={editCustomCategoryName}
                                        onChange={(event) => setEditCustomCategoryName(event.target.value)}
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setIsAddingEditCustomCategory(false)
                                            setEditCustomCategoryName("")
                                            setEditCategoryId("")
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Select
                                        value={editCategoryId || NO_CATEGORY_VALUE}
                                        onValueChange={(value) => {
                                            setIsAddingEditCustomCategory(false)
                                            setEditCustomCategoryName("")
                                            setEditCategoryId(value === NO_CATEGORY_VALUE ? "" : value)
                                        }}
                                    >
                                        <SelectTrigger id="edit-category" className="w-full">
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
                                            setIsAddingEditCustomCategory(true)
                                            setEditCategoryId("")
                                        }}
                                    >
                                        Add category
                                    </Button>
                                </div>
                            )}
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-quantity">Initial stock</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.quantityInitial}</FieldError>
                            </div>
                            <Input
                                id="edit-quantity"
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                placeholder="Enter initial stock"
                                value={editQuantityInitial}
                                onChange={(event) => setEditQuantityInitial(toIntegerInput(event.target.value))}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-unit-price">Unit price</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.unitPriceForeign}</FieldError>
                            </div>
                            <Input
                                id="edit-unit-price"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="Enter unit price"
                                value={editUnitPriceForeign}
                                onChange={(event) => setEditUnitPriceForeign(toDecimalInput(event.target.value))}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-intended-selling-price">Selling price (RWF, optional)</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.intendedSellingPrice}</FieldError>
                            </div>
                            <Input
                                id="edit-intended-selling-price"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="Enter intended selling price"
                                value={editIntendedSellingPrice}
                                onChange={(event) => setEditIntendedSellingPrice(toDecimalInput(event.target.value))}
                            />
                        </Field>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-currency">Source currency</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.sourceCurrency}</FieldError>
                            </div>
                            <Select value={editSourceCurrency} onValueChange={setEditSourceCurrency}>
                                <SelectTrigger id="edit-currency">
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
                                <FieldLabel htmlFor="edit-exchange-rate">Exchange rate to RWF</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.exchangeRate}</FieldError>
                            </div>
                            <Input
                                id="edit-exchange-rate"
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder={editSourceCurrency === "RWF" ? "Auto-set to 1 for RWF" : "Enter exchange rate to RWF"}
                                value={editExchangeRate}
                                disabled={editSourceCurrency === "RWF"}
                                onChange={(event) => setEditExchangeRate(toDecimalInput(event.target.value))}
                            />
                        </Field>
                    </div>

                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm">Batch Settings</h3>

                        <Field>
                            <div className="flex items-center justify-between">
                                <FieldLabel htmlFor="edit-batch">Batch</FieldLabel>
                                <FieldError className="text-destructive text-xs">{editErrors.batchId}</FieldError>
                            </div>
                            <div className="flex gap-2">
                                <Select value={editBatchId} onValueChange={setEditBatchId}>
                                    <SelectTrigger id="edit-batch" className="w-full">
                                        <SelectValue placeholder="Select batch" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {batches.map((batch) => (
                                            <SelectItem key={batch._id} value={batch._id}>
                                                {batch.batchName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {editBatchId && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setEditBatchId("")}
                                    >
                                        Clear
                                    </Button>
                                )}
                            </div>
                        </Field>
                    </div>

                    {editErrors.general ? (
                        <p className="text-sm text-destructive">{editErrors.general}</p>
                    ) : null}
                    <Button type="submit" disabled={!canSubmitEditProduct || !hasEditProductChanges || isEditSubmitting} loading={isEditSubmitting} loadingText="Saving product">
                        Save Changes
                    </Button>
                </form>
            </ProductSheetFrame>

            {previewImageSrc ? (
                <div
                    className="fixed inset-0 z-120 flex items-center justify-center bg-black/80 p-4"
                    style={{ zIndex: 120, pointerEvents: "auto" }}
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            event.preventDefault()
                            closeImagePreview()
                        }
                    }}
                    data-image-preview="true"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Image preview"
                >
                    {previewImages.length > 1 ? (
                        <button
                            type="button"
                            className="absolute left-4 top-1/2 z-121 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                            style={{ zIndex: 121, pointerEvents: "auto" }}
                            onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                            }}
                            onClick={(event) => {
                                event.stopPropagation()
                                showPreviousPreviewImage()
                            }}
                            title="Previous image"
                        >
                            <ChevronLeftIcon className="h-5 w-5" />
                        </button>
                    ) : null}

                    <button
                        type="button"
                        className="absolute right-4 top-4 z-121 cursor-pointer rounded-md bg-black/70 p-2 text-white hover:bg-black"
                        style={{ zIndex: 121, pointerEvents: "auto" }}
                        onMouseDown={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                        }}
                        onClick={(event) => {
                            event.stopPropagation()
                            closeImagePreview()
                        }}
                    >
                        <XIcon className="h-5 w-5" />
                    </button>

                    {previewImages.length > 1 ? (
                        <button
                            type="button"
                            className="absolute right-4 top-1/2 z-121 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                            style={{ zIndex: 121, pointerEvents: "auto" }}
                            onMouseDown={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                            }}
                            onClick={(event) => {
                                event.stopPropagation()
                                showNextPreviewImage()
                            }}
                            title="Next image"
                        >
                            <ChevronRightIcon className="h-5 w-5" />
                        </button>
                    ) : null}

                    <img
                        src={previewImageSrc}
                        alt="Preview"
                        className="max-h-[92vh] w-auto max-w-[96vw] rounded-xl object-contain"
                        loading="lazy"
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            ) : null}
        </>
    )
}
