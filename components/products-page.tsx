"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
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
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@/components/ui/empty"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronLeftIcon, ChevronRightIcon, ImagePlusIcon, LayoutGridIcon, ListIcon, PackageSearchIcon, PencilIcon, XIcon } from "lucide-react"

const SOURCE_CURRENCY_OPTIONS = ["RWF", "USD", "KSH", "UGX", "AED", "EUR", "GBP"]
const NO_CATEGORY_VALUE = "__none__"
const COMMON_CATEGORY_OPTIONS = [
    "Electronics",
    "Fashion",
    "Beauty",
    "Home & Kitchen",
    "Health",
    "Sports",
    "Kids & Baby",
]

type Category = { _id: string; name: string }
type Batch = { _id: string; batchName: string }

type Product = {
    _id: string
    name: string
    categoryId?: { _id?: string; name?: string }
    batchId?: { _id?: string; batchName?: string } | null
    quantityInitial: number
    quantityRemaining: number
    unitPriceForeign: number
    unitPriceLocalRWF?: number
    sourceCurrency: string
    exchangeRate?: number
    purchasePriceRWF: number
    landedCost: number
    externalLink?: string
    images: string[]
    createdAt: string
}

export function ProductsPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [products, setProducts] = React.useState<Product[]>([])
    const [categories, setCategories] = React.useState<Category[]>([])
    const [batches, setBatches] = React.useState<Batch[]>([])
    const [isLoading, setIsLoading] = React.useState(true)
    const [viewMode, setViewMode] = React.useState<"list" | "grid">("list")
    const [isAddProductSheetOpen, setIsAddProductSheetOpen] = React.useState(false)
    const [isEditProductSheetOpen, setIsEditProductSheetOpen] = React.useState(false)
    const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set())
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [productName, setProductName] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("")
    const [quantityInitial, setQuantityInitial] = React.useState("0")
    const [unitPriceForeign, setUnitPriceForeign] = React.useState("0")
    const [productExternalLink, setProductExternalLink] = React.useState("")
    const [sourceCurrency, setSourceCurrency] = React.useState("USD")
    const [exchangeRate, setExchangeRate] = React.useState("1")
    const [imageFiles, setImageFiles] = React.useState<File[]>([])
    const [imagePreviews, setImagePreviews] = React.useState<string[]>([])

    const [showSaleModal, setShowSaleModal] = React.useState(false)
    const [showDiscardSaleConfirm, setShowDiscardSaleConfirm] = React.useState(false)
    const [saleStep, setSaleStep] = React.useState<"product" | "details">("product")
    const [saleSelectedProduct, setSaleSelectedProduct] = React.useState<Product | null>(null)
    const [saleQuantity, setSaleQuantity] = React.useState("")
    const [salePrice, setSalePrice] = React.useState("")
    const [saleProductSearch, setSaleProductSearch] = React.useState("")
    const [saleErrors, setSaleErrors] = React.useState<Record<string, string>>({})
    const [isSaleSubmitting, setIsSaleSubmitting] = React.useState(false)

    const [editProductId, setEditProductId] = React.useState("")
    const [editProductName, setEditProductName] = React.useState("")
    const [editQuantityInitial, setEditQuantityInitial] = React.useState("0")
    const [editUnitPriceForeign, setEditUnitPriceForeign] = React.useState("0")
    const [editExternalLink, setEditExternalLink] = React.useState("")
    const [editSourceCurrency, setEditSourceCurrency] = React.useState("USD")
    const [editExchangeRate, setEditExchangeRate] = React.useState("1")
    const [editBatchId, setEditBatchId] = React.useState("")
    const [editProductImages, setEditProductImages] = React.useState<string[]>([])
    const [editNewImages, setEditNewImages] = React.useState<File[]>([])
    const [editNewImagePreviews, setEditNewImagePreviews] = React.useState<string[]>([])
    const [editDeletedImageIndices, setEditDeletedImageIndices] = React.useState<Set<number>>(new Set())
    const [editErrors, setEditErrors] = React.useState<Record<string, string>>({})
    const [isEditSubmitting, setIsEditSubmitting] = React.useState(false)

    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
    const [deleteConfirmData, setDeleteConfirmData] = React.useState<{
        productId: string
        productName: string
        hasActiveSales: boolean
        salesCount: number
        isInBatch: boolean
        batchName: string | null
    } | null>(null)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [previewImages, setPreviewImages] = React.useState<string[]>([])
    const [previewImageIndex, setPreviewImageIndex] = React.useState(0)
    const previewImageSrc = previewImages[previewImageIndex] ?? null
    const isPreviewOpen = previewImages.length > 0

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

    const toIntegerInput = (value: string) => value.replace(/\D/g, "")

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

    const load = React.useCallback(async () => {
        setIsLoading(true)
        try {
            const [productsResponse, categoriesResponse, batchesResponse] = await Promise.all([
                fetch("/api/products"),
                fetch("/api/categories"),
                fetch("/api/batches"),
            ])

            if (productsResponse.ok) {
                const productsData = await productsResponse.json()
                setProducts(productsData.products ?? [])
            }

            if (categoriesResponse.ok) {
                const categoriesData = await categoriesResponse.json()
                setCategories(categoriesData.categories ?? [])
            }

            if (batchesResponse.ok) {
                const batchesData = await batchesResponse.json()
                setBatches(batchesData.batches ?? [])
            }
        } finally {
            setIsLoading(false)
        }
    }, [])

    React.useEffect(() => {
        load()
    }, [load])

    React.useEffect(() => {
        const previews = imageFiles.map((file) => URL.createObjectURL(file))
        setImagePreviews(previews)

        return () => {
            previews.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [imageFiles])

    React.useEffect(() => {
        if (sourceCurrency === "RWF") {
            setExchangeRate("1")
        }
    }, [sourceCurrency])

    React.useEffect(() => {
        if (editSourceCurrency === "RWF") {
            setEditExchangeRate("1")
        }
    }, [editSourceCurrency])

    React.useEffect(() => {
        const previews = editNewImages.map((file) => URL.createObjectURL(file))
        setEditNewImagePreviews(previews)

        return () => {
            previews.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [editNewImages])

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

    const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        try {
            let resolvedCategoryId = categoryId

            if (categoryId.startsWith("common:")) {
                const commonCategoryName = categoryId.slice("common:".length)
                const existingCategory = categories.find(
                    (category) => category.name.trim().toLowerCase() === commonCategoryName.toLowerCase()
                )

                if (existingCategory?._id) {
                    resolvedCategoryId = existingCategory._id
                } else {
                    const createCategoryResponse = await fetch("/api/categories", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: commonCategoryName }),
                    })

                    const createCategoryData = await createCategoryResponse.json()
                    if (!createCategoryResponse.ok) {
                        setErrors(createCategoryData.errors ?? { categoryId: "Failed to create selected category" })
                        return
                    }

                    resolvedCategoryId = createCategoryData.category?._id ?? ""
                }
            }

            const formData = new FormData()
            formData.append("name", productName)
            if (resolvedCategoryId) {
                formData.append("categoryId", resolvedCategoryId)
            }
            formData.append("quantityInitial", quantityInitial)
            formData.append("unitPriceForeign", stripCommas(unitPriceForeign))
            formData.append("externalLink", productExternalLink)
            formData.append("sourceCurrency", sourceCurrency)
            formData.append("exchangeRate", stripCommas(exchangeRate))

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

            setProductName("")
            setCategoryId("")
            setQuantityInitial("0")
            setUnitPriceForeign("0")
            setProductExternalLink("")
            setSourceCurrency("USD")
            setExchangeRate("1")
            setImageFiles([])
            setIsAddProductSheetOpen(false)
            await load()
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditProductSheet = (product: Product) => {
        setEditProductId(product._id)
        setEditProductName(product.name)
        setEditQuantityInitial(String(product.quantityInitial))
        setEditUnitPriceForeign(formatDecimalWithCommas(String(product.unitPriceForeign)))
        setEditExternalLink(product.externalLink ?? "")
        setEditSourceCurrency(product.sourceCurrency)
        setEditExchangeRate(formatDecimalWithCommas(String(product.exchangeRate ?? 1)))
        setEditBatchId(product.batchId?._id ?? "")
        setEditProductImages(product.images ?? [])
        setEditNewImages([])
        setEditNewImagePreviews([])
        setEditDeletedImageIndices(new Set())
        setEditErrors({})
        setIsEditProductSheetOpen(true)
    }

    const resetSaleDraft = () => {
        setSaleStep("product")
        setSaleSelectedProduct(null)
        setSaleQuantity("")
        setSalePrice("")
        setSaleProductSearch("")
        setSaleErrors({})
    }

    React.useEffect(() => {
        if (searchParams.get("addProduct") !== "1") {
            return
        }

        setIsAddProductSheetOpen(true)

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete("addProduct")
        const nextQuery = nextParams.toString()
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    }, [searchParams, pathname, router])

    React.useEffect(() => {
        if (searchParams.get("quickSale") !== "1") {
            return
        }

        setSaleStep("product")
        setSaleSelectedProduct(null)
        setSaleQuantity("")
        setSalePrice("")
        setSaleProductSearch("")
        setSaleErrors({})
        setShowSaleModal(true)

        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete("quickSale")
        const nextQuery = nextParams.toString()
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname)
    }, [searchParams, pathname, router])

    const openSaleModalForProduct = (product: Product) => {
        setSaleSelectedProduct(product)
        setSalePrice(formatDecimalWithCommas(String(product.landedCost)))
        setSaleQuantity("")
        setSaleStep("details")
        setSaleErrors({})
        setShowSaleModal(true)
    }

    const hasUnsavedSaleDraft = Boolean(saleSelectedProduct) || Boolean(saleQuantity) || Boolean(saleProductSearch)

    const requestCloseSaleModal = () => {
        if (isSaleSubmitting) {
            return
        }

        if (hasUnsavedSaleDraft) {
            setShowDiscardSaleConfirm(true)
            return
        }

        setShowSaleModal(false)
        resetSaleDraft()
    }

    const discardSaleDraftAndClose = () => {
        setShowDiscardSaleConfirm(false)
        setShowSaleModal(false)
        resetSaleDraft()
    }

    const submitSaleFromModal = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (!saleSelectedProduct) {
            setSaleErrors({ productId: "Product is required" })
            return
        }

        setIsSaleSubmitting(true)
        setSaleErrors({})

        try {
            const response = await fetch("/api/sales", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId: saleSelectedProduct._id,
                    quantity: Number(saleQuantity),
                    sellingPrice: Number(stripCommas(salePrice)),
                }),
            })

            const data = await response.json()
            if (!response.ok) {
                setSaleErrors(data.errors ?? { general: "Failed to save sale" })
                return
            }

            setShowSaleModal(false)
            resetSaleDraft()
            await load()
        } finally {
            setIsSaleSubmitting(false)
        }
    }

    const handleSelectSaleProduct = (product: Product) => {
        setSaleSelectedProduct(product)
        setSalePrice(formatDecimalWithCommas(String(product.landedCost)))
        setSaleStep("details")
        setSaleErrors({})
    }

    const submitEditProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setEditErrors({})
        setIsEditSubmitting(true)

        try {
            const formData = new FormData()
            formData.append("name", editProductName)
            formData.append("quantityInitial", editQuantityInitial)
            formData.append("unitPriceForeign", stripCommas(editUnitPriceForeign))
            formData.append("externalLink", editExternalLink)
            formData.append("sourceCurrency", editSourceCurrency)
            formData.append("exchangeRate", stripCommas(editExchangeRate))
            formData.append("batchId", editBatchId || "")

            // Add remaining existing images (not deleted)
            editProductImages.forEach((image, index) => {
                if (!editDeletedImageIndices.has(index)) {
                    formData.append("existingImages", image)
                }
            })

            // Add new images
            editNewImages.forEach((file) => {
                formData.append("newImages", file)
            })

            const response = await fetch(`/api/products/${editProductId}`, {
                method: "PATCH",
                body: formData,
            })

            const data = await response.json()
            if (!response.ok) {
                setEditErrors(data.errors ?? { general: "Failed to update product" })
                return
            }

            setEditProductId("")
            setEditProductName("")
            setEditQuantityInitial("0")
            setEditUnitPriceForeign("0")
            setEditExternalLink("")
            setEditSourceCurrency("USD")
            setEditExchangeRate("1")
            setEditBatchId("")
            setEditProductImages([])
            setEditNewImages([])
            setEditNewImagePreviews([])
            setEditDeletedImageIndices(new Set())
            setIsEditProductSheetOpen(false)
            await load()
        } finally {
            setIsEditSubmitting(false)
        }
    }

    const handleDeleteProduct = async (product: Product) => {
        try {
            const response = await fetch(`/api/products/${product._id}`, {
                method: "DELETE",
            })

            const data = await response.json()
            if (!response.ok) {
                alert("Failed to get deletion info")
                return
            }

            setDeleteConfirmData({
                productId: product._id,
                productName: product.name,
                hasActiveSales: data.deletionInfo.hasActiveSales,
                salesCount: data.deletionInfo.salesCount,
                isInBatch: data.deletionInfo.isInBatch,
                batchName: data.deletionInfo.batchName,
            })
            setShowDeleteConfirm(true)
        } catch (error) {
            alert("Failed to get deletion info")
            console.error(error)
        }
    }

    const confirmDeleteProduct = async () => {
        if (!deleteConfirmData) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/products/${deleteConfirmData.productId}?confirm=true`, {
                method: "DELETE",
            })

            if (!response.ok) {
                alert("Failed to delete product")
                return
            }

            setShowDeleteConfirm(false)
            setDeleteConfirmData(null)
            await load()
        } catch (error) {
            alert("Failed to delete product")
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    const saleFilteredProducts = products.filter((product) =>
        product.name.toLowerCase().includes(saleProductSearch.toLowerCase())
    )

    const saleSelectedQuantity = Number(saleQuantity || 0)
    const saleAvailableQuantity = saleSelectedProduct?.quantityRemaining ?? 0
    const saleIsQuantityAboveAvailable = Boolean(saleSelectedProduct) && saleSelectedQuantity > saleAvailableQuantity
    const saleProfitPerUnit = saleSelectedProduct
        ? Number(stripCommas(salePrice) || 0) - saleSelectedProduct.landedCost
        : 0
    const saleTotalLandedCost = saleSelectedProduct
        ? saleSelectedProduct.landedCost * saleSelectedQuantity
        : 0
    const canSubmitSale = Boolean(saleSelectedProduct) && saleSelectedQuantity > 0 && Boolean(salePrice) && !saleIsQuantityAboveAvailable && !isSaleSubmitting

    const renderProductActions = (product: Product) => (
        <div className="flex gap-2">
            {product.externalLink && (
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                >
                    <a href={product.externalLink} target="_blank" rel="noreferrer">
                        <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </Button>
            )}
            <Sheet
                open={isEditProductSheetOpen}
                onOpenChange={(open) => {
                    if (!open && isPreviewOpen) {
                        return
                    }

                    setIsEditProductSheetOpen(open)
                }}
            >
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditProductSheet(product)}
                    >
                        Edit
                    </Button>
                </SheetTrigger>
                <SheetContent
                    className="overflow-y-auto"
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
                    <SheetHeader>
                        <SheetTitle className="truncate">Edit {product.name}</SheetTitle>
                        <SheetDescription>
                            Update product details and batch assignment.
                        </SheetDescription>
                    </SheetHeader>
                    <form className="grid gap-6 p-4" onSubmit={submitEditProduct}>
                        {/* Images Section */}
                        <div className="space-y-3 border-b pb-4">
                            <h3 className="font-semibold text-sm">Images</h3>

                            {/* Main Image Display (first existing image or first new image) */}
                            <div className="relative h-64 w-full overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center group">
                                {editProductImages[0] && !editDeletedImageIndices.has(0) ? (
                                    <>
                                        <img
                                            src={editProductImages[0]}
                                            alt="Main product image"
                                            className="h-full w-full cursor-pointer object-cover"
                                            onClick={() => openImagePreview([...(editProductImages.filter((_, index) => !editDeletedImageIndices.has(index))), ...editNewImagePreviews], 0)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newDeleted = new Set(editDeletedImageIndices)
                                                newDeleted.add(0)
                                                setEditDeletedImageIndices(newDeleted)
                                            }}
                                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <XIcon className="h-4 w-4" />
                                        </button>
                                    </>
                                ) : editNewImagePreviews[0] ? (
                                    <>
                                        <img
                                            src={editNewImagePreviews[0]}
                                            alt="New main image"
                                            className="h-full w-full cursor-pointer object-cover"
                                            onClick={() => openImagePreview([...(editProductImages.filter((_, index) => !editDeletedImageIndices.has(index))), ...editNewImagePreviews], Math.max(0, editProductImages.filter((_, index) => !editDeletedImageIndices.has(index)).length))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const newNewImages = editNewImages.filter((_, i) => i !== 0)
                                                setEditNewImages(newNewImages)
                                            }}
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
                                            className="hidden"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0]
                                                if (file) {
                                                    setEditNewImages([file, ...editNewImages])
                                                }
                                            }}
                                        />
                                    </label>
                                )}
                            </div>

                            {/* Image Grid - Dynamic cells for remaining images */}
                            {(editProductImages.length > 1 || editNewImages.length > 1 ||
                                editProductImages.length + editNewImages.length - editDeletedImageIndices.size < 4) && (
                                    <div className="grid grid-cols-3 gap-2">
                                        {/* Show remaining existing images (up to 3 after main) */}
                                        {editProductImages.slice(1).map((image, sliceIndex) => {
                                            const actualIndex = sliceIndex + 1
                                            if (editDeletedImageIndices.has(actualIndex) || sliceIndex >= 3) return null

                                            return (
                                                <div key={`existing-${actualIndex}`} className="relative aspect-square rounded-md border border-border overflow-hidden group bg-muted/30">
                                                    <img
                                                        src={image}
                                                        alt={`Product image ${actualIndex + 1}`}
                                                        className="w-full h-full cursor-pointer object-cover"
                                                        onClick={() => {
                                                            const previewList = [...(editProductImages.filter((_, index) => !editDeletedImageIndices.has(index))), ...editNewImagePreviews]
                                                            const imageIndex = previewList.indexOf(image)
                                                            openImagePreview(previewList, imageIndex === -1 ? 0 : imageIndex)
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newDeleted = new Set(editDeletedImageIndices)
                                                            newDeleted.add(actualIndex)
                                                            setEditDeletedImageIndices(newDeleted)
                                                        }}
                                                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <XIcon className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )
                                        })}

                                        {/* Show new images (up to 3 total after considering remaining existing) */}
                                        {editNewImages.map((file, newIndex) => {
                                            const remainingExistingCount = editProductImages.slice(1).filter((_, i) => !editDeletedImageIndices.has(i + 1)).length
                                            if (newIndex >= 3 - remainingExistingCount) return null

                                            return (
                                                <div key={`new-${newIndex}`} className="relative aspect-square rounded-md border border-border overflow-hidden group bg-muted/30">
                                                    <img
                                                        src={editNewImagePreviews[newIndex]}
                                                        alt={`New image ${newIndex + 1}`}
                                                        className="w-full h-full cursor-pointer object-cover"
                                                        onClick={() => {
                                                            const previewList = [...(editProductImages.filter((_, index) => !editDeletedImageIndices.has(index))), ...editNewImagePreviews]
                                                            const imageIndex = previewList.indexOf(editNewImagePreviews[newIndex])
                                                            openImagePreview(previewList, imageIndex === -1 ? 0 : imageIndex)
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newNewImages = editNewImages.filter((_, i) => i !== newIndex)
                                                            setEditNewImages(newNewImages)
                                                        }}
                                                        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <XIcon className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )
                                        })}

                                        {/* Add slot - show only if less than 4 total images */}
                                        {(() => {
                                            const totalExistingAfterDelete = editProductImages.filter((_, i) => !editDeletedImageIndices.has(i)).length
                                            const totalImages = totalExistingAfterDelete + editNewImages.length
                                            const gridCellsNeeded = Math.max(0, totalExistingAfterDelete - 1 + editNewImages.length)
                                            if (totalImages < 4 && gridCellsNeeded < 3) {
                                                return (
                                                    <label className="relative aspect-square rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors group">
                                                        <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(event) => {
                                                                const file = event.target.files?.[0]
                                                                if (file) {
                                                                    setEditNewImages([...editNewImages, file])
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                )
                                            }
                                        })()}
                                    </div>
                                )}
                        </div>

                        {/* Product Details Section */}
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
                                    <FieldLabel htmlFor="edit-quantity">Initial stock</FieldLabel>
                                    <FieldError className="text-destructive text-xs">{editErrors.quantityInitial}</FieldError>
                                </div>
                                <Input
                                    id="edit-quantity"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    placeholder="Initial stock"
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
                                    placeholder="Unit price in source currency"
                                    value={editUnitPriceForeign}
                                    onChange={(event) => setEditUnitPriceForeign(toDecimalInput(event.target.value))}
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
                                    placeholder="Exchange rate to RWF"
                                    value={editExchangeRate}
                                    disabled={editSourceCurrency === "RWF"}
                                    onChange={(event) => setEditExchangeRate(toDecimalInput(event.target.value))}
                                />
                            </Field>
                        </div>

                        {/* Batch Settings Section */}
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
                        <Button type="submit" loading={isEditSubmitting} loadingText="Saving product">
                            Save Changes
                        </Button>
                    </form>
                </SheetContent>
            </Sheet>

            <Button
                variant="outline"
                size="sm"
                onClick={() => openSaleModalForProduct(product)}
            >
                Sell
            </Button>
        </div>
    )

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="flex items-center justify-between gap-3">
                <div>
                    <CardTitle className="text-2xl font-bold">Products</CardTitle>
                    <CardDescription>Manage products, stock, and batch assignment</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex rounded-md border p-1">
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === "list" ? "default" : "ghost"}
                            onClick={() => setViewMode("list")}
                            aria-label="List view"
                            title="List view"
                            className="h-8 gap-1 rounded-sm px-2"
                        >
                            <ListIcon className="h-4 w-4" />
                            <span>List</span>
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant={viewMode === "grid" ? "default" : "ghost"}
                            onClick={() => setViewMode("grid")}
                            aria-label="Grid view"
                            title="Grid view"
                            className="h-8 gap-1 rounded-sm px-2"
                        >
                            <LayoutGridIcon className="h-4 w-4" />
                            <span>Grid</span>
                        </Button>
                    </div>
                    <Sheet
                        open={isAddProductSheetOpen}
                        onOpenChange={(open) => {
                            if (!open && isPreviewOpen) {
                                return
                            }

                            setIsAddProductSheetOpen(open)
                        }}
                    >
                        <SheetTrigger asChild>
                            <Button size={"lg"} className="px-6 h-10">Add Product</Button>
                        </SheetTrigger>
                        <SheetContent
                            className="p-0"
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
                            <div className="flex h-full flex-col">
                                <SheetHeader className="border-b">
                                    <SheetTitle>Add Product</SheetTitle>
                                    <SheetDescription>Create a new product entry.</SheetDescription>
                                </SheetHeader>
                                <form className="flex-1 overflow-y-auto grid gap-6 p-4" onSubmit={submitProduct}>
                                    <Field>
                                        <div className="space-y-3 border-b pb-4">
                                            <h3 className="font-semibold text-sm">Images</h3>

                                            <div className="relative h-64 w-full overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center group">
                                                {imagePreviews[0] ? (
                                                    <>
                                                        <img
                                                            src={imagePreviews[0]}
                                                            alt="Main product image"
                                                            className="h-full w-full cursor-pointer object-cover"
                                                            onClick={() => openImagePreview(imagePreviews, 0)}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setImageFiles((current) => current.filter((_, index) => index !== 0))
                                                            }}
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
                                                            className="hidden"
                                                            onChange={(event) => {
                                                                const file = event.target.files?.[0]
                                                                if (file) {
                                                                    setImageFiles((current) => [file, ...current].slice(0, 4))
                                                                }
                                                            }}
                                                        />
                                                    </label>
                                                )}
                                            </div>

                                            {(imageFiles.length > 1 || imageFiles.length < 4) && (
                                                <div className="grid grid-cols-3 gap-2">
                                                    {imagePreviews.slice(1, 4).map((preview, index) => {
                                                        const imageIndex = index + 1

                                                        return (
                                                            <div key={`new-${imageIndex}`} className="relative aspect-square rounded-md border border-border overflow-hidden group bg-muted/30">
                                                                <img
                                                                    src={preview}
                                                                    alt={`New image ${imageIndex + 1}`}
                                                                    className="w-full h-full cursor-pointer object-cover"
                                                                    onClick={() => openImagePreview(imagePreviews, imageIndex)}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setImageFiles((current) => current.filter((_, currentIndex) => currentIndex !== imageIndex))
                                                                    }}
                                                                    className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    <XIcon className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )
                                                    })}

                                                    {imageFiles.length < 4 ? (
                                                        <label className="relative aspect-square rounded-md border-2 border-dashed border-border bg-muted/30 flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors group">
                                                            <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                className="hidden"
                                                                onChange={(event) => {
                                                                    const file = event.target.files?.[0]
                                                                    if (file) {
                                                                        setImageFiles((current) => [...current, file].slice(0, 4))
                                                                    }
                                                                }}
                                                            />
                                                        </label>
                                                    ) : null}
                                                </div>
                                            )}
                                        </div>
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-name">Product name</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.name}</FieldError>
                                        </div>
                                        <Input
                                            id="product-name"
                                            placeholder="Product name"
                                            value={productName}
                                            onChange={(event) => setProductName(event.target.value)}
                                        />
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-external-link">External link (optional)</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.externalLink}</FieldError>
                                        </div>
                                        <Input
                                            id="product-external-link"
                                            type="url"
                                            placeholder="https://example.com/product"
                                            value={productExternalLink}
                                            onChange={(event) => setProductExternalLink(event.target.value)}
                                        />
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-category">Category (optional)</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.categoryId}</FieldError>
                                        </div>
                                        <Select
                                            value={categoryId || NO_CATEGORY_VALUE}
                                            onValueChange={(value) => setCategoryId(value === NO_CATEGORY_VALUE ? "" : value)}
                                        >
                                            <SelectTrigger id="product-category">
                                                <SelectValue placeholder="Choose category (optional)" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NO_CATEGORY_VALUE}>No category</SelectItem>
                                                {categories.map((category) => (
                                                    <SelectItem key={category._id} value={category._id}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                                {COMMON_CATEGORY_OPTIONS.map((categoryName) => (
                                                    <SelectItem key={categoryName} value={`common:${categoryName}`}>
                                                        {categoryName}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-quantity">Initial stock</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.quantityInitial}</FieldError>
                                        </div>
                                        <Input
                                            id="product-quantity"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="off"
                                            placeholder="Initial stock"
                                            value={quantityInitial}
                                            onChange={(event) => setQuantityInitial(toIntegerInput(event.target.value))}
                                        />
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-unit-price">Unit price</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.unitPriceForeign}</FieldError>
                                        </div>
                                        <Input
                                            id="product-unit-price"
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            placeholder="Unit price in source currency"
                                            value={unitPriceForeign}
                                            onChange={(event) => setUnitPriceForeign(toDecimalInput(event.target.value))}
                                        />
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-currency">Source currency</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.sourceCurrency}</FieldError>
                                        </div>
                                        <Select value={sourceCurrency} onValueChange={setSourceCurrency}>
                                            <SelectTrigger id="product-currency">
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
                                            <FieldLabel htmlFor="product-exchange-rate">Exchange rate to RWF</FieldLabel>
                                            <FieldError className="text-destructive text-xs">{errors.exchangeRate}</FieldError>
                                        </div>
                                        <Input
                                            id="product-exchange-rate"
                                            type="text"
                                            inputMode="decimal"
                                            autoComplete="off"
                                            placeholder="Exchange rate to RWF"
                                            value={exchangeRate}
                                            disabled={sourceCurrency === "RWF"}
                                            onChange={(event) => setExchangeRate(toDecimalInput(event.target.value))}
                                        />
                                    </Field>

                                    {errors.general ? <FieldError className="text-destructive text-xs">{errors.general}</FieldError> : null}

                                    <Button type="submit" loading={isSubmitting} loadingText="Adding product">
                                        Add Product
                                    </Button>
                                </form>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Image</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>On Hand</TableHead>
                                    <TableHead>Buying Price (RWF)</TableHead>
                                    <TableHead>Landed Price (RWF)</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <TableRow key={`products-loading-${index}`}>
                                        <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                        <TableCell><Skeleton className="h-6 w-14 rounded-full" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                                        <TableCell><Skeleton className="h-8 w-28 rounded-md" /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : products.length === 0 ? (
                    <Empty className="mt-16">
                        <EmptyHeader>
                            <div className="bg-border/40 mb-4 rounded-lg p-3">
                                <PackageSearchIcon className="size-10" />
                            </div>
                            <EmptyTitle>No products yet</EmptyTitle>
                            <EmptyDescription>
                                There are no products in inventory right now. Create your first product to start tracking stock and sales.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent className="flex-row justify-center gap-2">
                            <Button onClick={() => setIsAddProductSheetOpen(true)}>Add your first product</Button>
                        </EmptyContent>
                    </Empty>
                ) : viewMode === "list" ? (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex gap-2 items-center">
                                <h3 className="text-sm text-muted-foreground">Total</h3>
                                <p className="text-lg font-semibold">{products.length}</p>
                                {selectedProductIds.size > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">|</span>
                                        <p className="text-sm font-medium text-primary">{selectedProductIds.size} selected</p>
                                    </>
                                )}
                            </div>
                            {selectedProductIds.size > 0 && (
                                <Button size="sm" variant="outline" onClick={() => setSelectedProductIds(new Set())}>Clear Selection</Button>
                            )}
                        </div>
                        <div className="overflow-hidden rounded-xl border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-12"><input type="checkbox" className="rounded" onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedProductIds(new Set(products.map(p => p._id)))
                                            } else {
                                                setSelectedProductIds(new Set())
                                            }
                                        }} checked={selectedProductIds.size === products.length && products.length > 0} title="Select all" /></TableHead>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Batch</TableHead>
                                        <TableHead>On Hand</TableHead>
                                        <TableHead>Buying Price (RWF)</TableHead>
                                        <TableHead>Landed Price (RWF)</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {products.map((product) => (
                                        <TableRow
                                            key={product._id}
                                            className="p-0"
                                        >
                                            <TableCell onClick={(e) => e.stopPropagation()} className="p-3">
                                                <input type="checkbox" className="rounded" checked={selectedProductIds.has(product._id)} onChange={(e) => {
                                                    const newSelected = new Set(selectedProductIds)
                                                    if (e.target.checked) {
                                                        newSelected.add(product._id)
                                                    } else {
                                                        newSelected.delete(product._id)
                                                    }
                                                    setSelectedProductIds(newSelected)
                                                }} />
                                            </TableCell>
                                            <TableCell className="p-0">
                                                <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50">
                                                    {product.images?.[0] ? (
                                                        <img
                                                            src={product.images[0]}
                                                            alt={product.name}
                                                            className="h-10 w-10 rounded-md object-cover"
                                                        />
                                                    ) : (
                                                        <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                                            {product.name.replace(/\s+/g, "").slice(0, 2).toUpperCase()}
                                                        </div>
                                                    )}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="p-0 truncate max-w-xs">
                                                <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50">
                                                    {product.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="p-0">
                                                <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50">
                                                    {product.batchId?.batchName ?? "Unassigned"}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="p-0">
                                                <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50">
                                                    <Badge variant={product.quantityRemaining > 0 ? "outline" : "destructive"}>
                                                        {product.quantityRemaining}
                                                    </Badge>
                                                </Link>
                                            </TableCell>
                                            <TableCell className="p-0">
                                                <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50">
                                                    {product.purchasePriceRWF.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </Link>
                                            </TableCell>
                                            <TableCell className="p-0">
                                                <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50">
                                                    {product.landedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </Link>
                                            </TableCell>
                                            <TableCell onClick={(event) => event.stopPropagation()}>{renderProductActions(product)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {products.map((product) => (
                            <div
                                key={product._id}
                                className="rounded-lg border bg-card p-4"
                            >
                                <Link href={`/app/products/${product._id}`} className="block mb-3 overflow-hidden rounded-md border bg-muted">
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="h-36 w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-36 w-full flex items-center justify-center">
                                            <div className="text-3xl font-bold text-muted-foreground">
                                                {product.name.replace(/\s+/g, "").slice(0, 2).toUpperCase()}
                                            </div>
                                        </div>
                                    )}
                                </Link>
                                <div className="mb-1 truncate text-base font-semibold text-card-foreground">
                                    <Link href={`/app/products/${product._id}`} className="hover:underline">
                                        {product.name}
                                    </Link>
                                </div>
                                <div className="text-sm text-muted-foreground">Category: {product.categoryId?.name ?? "-"}</div>
                                <div className="text-sm text-muted-foreground">Batch: {product.batchId?.batchName ?? "Unassigned"}</div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Badge variant={product.quantityRemaining > 0 ? "outline" : "destructive"}>
                                        Stock: {product.quantityRemaining}
                                    </Badge>
                                    <Badge variant="secondary">Buying Price: RWF {product.purchasePriceRWF.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
                                </div>
                                <div className="mt-3 text-xs text-muted-foreground">
                                    Landed Price (RWF): {product.landedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="mt-4" onClick={(event) => event.stopPropagation()}>{renderProductActions(product)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            {showSaleModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
                    onClick={requestCloseSaleModal}
                >
                    <div
                        className="modal-pop-in bg-card rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-border"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <form className="p-6" onSubmit={submitSaleFromModal}>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-foreground">
                                    {saleStep === "product" ? "Select Product" : "Record Sale"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={requestCloseSaleModal}
                                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                                    aria-label="Close sale modal"
                                >
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>

                            {saleStep === "product" ? (
                                <>
                                    <Input
                                        placeholder="Search products..."
                                        value={saleProductSearch}
                                        onChange={(event) => setSaleProductSearch(event.target.value)}
                                        className="mb-4"
                                    />

                                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                                        {saleFilteredProducts.length === 0 ? (
                                            <p className="text-sm text-muted-foreground text-center py-4">
                                                No products found
                                            </p>
                                        ) : (
                                            saleFilteredProducts.map((product) => {
                                                const isOutOfStock = product.quantityRemaining === 0
                                                return (
                                                    <button
                                                        key={product._id}
                                                        type="button"
                                                        onClick={() => handleSelectSaleProduct(product)}
                                                        disabled={isOutOfStock}
                                                        className={`w-full text-left p-3 rounded-lg border transition-colors ${isOutOfStock
                                                            ? "cursor-not-allowed opacity-50 border-border"
                                                            : "border-border hover:bg-muted"
                                                            }`}
                                                    >
                                                        <p className="truncate font-medium text-foreground">{product.name}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            In stock: {product.quantityRemaining}
                                                            {isOutOfStock ? <span className="ml-2 font-medium text-destructive">(Out of stock)</span> : null}
                                                        </p>
                                                    </button>
                                                )
                                            })
                                        )}
                                    </div>

                                    <Button type="button" variant="outline" onClick={requestCloseSaleModal} className="w-full">
                                        Cancel
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <div className="mb-6">
                                        <h2 className="text-lg font-semibold text-foreground mb-2">
                                            {saleSelectedProduct?.name}
                                        </h2>
                                        <p className="text-sm text-muted-foreground">
                                            Available quantity: <span className="font-semibold text-foreground">{saleAvailableQuantity}</span>
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-sm font-medium text-foreground block mb-2">
                                                Quantity
                                            </label>
                                            <Input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="Enter quantity"
                                                value={saleQuantity}
                                                onChange={(event) => setSaleQuantity(toIntegerInput(event.target.value))}
                                            />
                                            {saleIsQuantityAboveAvailable ? (
                                                <p className="mt-2 text-xs font-medium text-destructive">
                                                    Requested quantity is higher than available stock.
                                                </p>
                                            ) : null}
                                            {saleErrors.quantity ? <FieldError className="text-destructive text-xs mt-2">{saleErrors.quantity}</FieldError> : null}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-foreground block mb-2">
                                                Selling Price per Unit
                                            </label>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="Enter selling price"
                                                value={salePrice}
                                                onChange={(event) => setSalePrice(toDecimalInput(event.target.value))}
                                            />
                                            {saleErrors.sellingPrice ? <FieldError className="text-destructive text-xs mt-2">{saleErrors.sellingPrice}</FieldError> : null}
                                        </div>

                                        {salePrice ? (
                                            <div className="p-3 rounded-lg bg-muted border border-border">
                                                {saleProfitPerUnit > 0 ? (
                                                    <p className="text-sm font-medium text-primary">
                                                        Profit: {saleProfitPerUnit.toLocaleString()} RWF per unit
                                                    </p>
                                                ) : saleProfitPerUnit < 0 ? (
                                                    <p className="text-sm font-medium text-destructive">
                                                        Loss: {Math.abs(saleProfitPerUnit).toLocaleString()} RWF per unit
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-medium text-muted-foreground">
                                                        Break-even price
                                                    </p>
                                                )}
                                            </div>
                                        ) : null}

                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                                            <p className="text-sm text-muted-foreground">
                                                Quantity selected: <span className="font-semibold text-foreground">{saleSelectedQuantity || 0}</span>
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Landed cost per unit: <span className="font-semibold text-foreground">{(saleSelectedProduct?.landedCost ?? 0).toLocaleString()} RWF</span>
                                            </p>
                                            <p className="text-sm text-muted-foreground">
                                                Total landed cost: <span className="font-semibold text-foreground">{saleTotalLandedCost.toLocaleString()} RWF</span>
                                            </p>
                                        </div>

                                        {saleErrors.general ? <FieldError className="text-destructive text-xs">{saleErrors.general}</FieldError> : null}
                                    </div>

                                    <div className="flex gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setSaleStep("product")
                                                setSaleSelectedProduct(null)
                                            }}
                                        >
                                            Back
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={!canSubmitSale}
                                            loading={isSaleSubmitting}
                                            loadingText="Recording sale"
                                            className="flex-1 disabled:opacity-40"
                                        >
                                            Record Sale
                                        </Button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {showDiscardSaleConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
                    <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-base font-semibold text-foreground">Discard sale draft?</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                            You have unsaved sale changes. Do you want to discard them and close?
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowDiscardSaleConfirm(false)}>
                                Continue editing
                            </Button>
                            <Button type="button" variant="destructive" onClick={discardSaleDraftAndClose}>
                                Discard and close
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteConfirm && deleteConfirmData && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
                    <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-lg font-semibold text-destructive">Delete Product?</h3>
                        <p className="mt-3 text-sm text-muted-foreground">
                            You are about to permanently delete <span className="font-semibold text-foreground">&quot;{deleteConfirmData.productName}&quot;</span>.
                        </p>

                        {(deleteConfirmData.hasActiveSales || deleteConfirmData.isInBatch) && (
                            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                                <p className="text-sm font-semibold text-accent-foreground mb-2">Warning:</p>
                                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                                    {deleteConfirmData.hasActiveSales && (
                                        <li>This product has <span className="font-semibold">{deleteConfirmData.salesCount}</span> sale(s) recorded.</li>
                                    )}
                                    {deleteConfirmData.isInBatch && (
                                        <li>This product is assigned to batch <span className="font-semibold">{deleteConfirmData.batchName}</span>.</li>
                                    )}
                                </ul>
                            </div>
                        )}

                        <p className="mt-4 text-xs text-muted-foreground">
                            This action cannot be undone.
                        </p>

                        <div className="mt-6 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    setDeleteConfirmData(null)
                                }}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={confirmDeleteProduct}
                                disabled={isDeleting}
                                loading={isDeleting}
                                loadingText="Deleting product"
                            >
                                Delete Permanently
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            ) : null}
        </div>
    )
}
