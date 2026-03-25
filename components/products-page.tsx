"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

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
import { ExternalLinkIcon, ImagePlusIcon, LayoutGridIcon, ListIcon, PackageSearchIcon, PencilIcon, XIcon } from "lucide-react"

const SOURCE_CURRENCY_OPTIONS = ["RWF", "USD", "KSH", "UGX", "AED", "EUR", "GBP"]

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
    const [isProductDetailsSheetOpen, setIsProductDetailsSheetOpen] = React.useState(false)
    const [detailsProduct, setDetailsProduct] = React.useState<Product | null>(null)
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
    const [editImageFile, setEditImageFile] = React.useState<File | null>(null)
    const [editImagePreview, setEditImagePreview] = React.useState<string>("")
    const [editExistingImage, setEditExistingImage] = React.useState<string>("")
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
        if (editImageFile) {
            const preview = URL.createObjectURL(editImageFile)
            setEditImagePreview(preview)
            return () => URL.revokeObjectURL(preview)
        } else {
            setEditImagePreview("")
        }
    }, [editImageFile])

    const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setIsSubmitting(true)
        setErrors({})

        try {
            const formData = new FormData()
            formData.append("name", productName)
            formData.append("categoryId", categoryId)
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

    const openProductDetailsSheet = (product: Product) => {
        setDetailsProduct(product)
        setIsProductDetailsSheetOpen(true)
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
        setEditImageFile(null)
        setEditImagePreview("")
        setEditExistingImage(product.images?.[0] ?? "")
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
            formData.append("existingImage", editExistingImage)

            if (editImageFile) {
                formData.append("image", editImageFile)
            }

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
            setEditImageFile(null)
            setEditImagePreview("")
            setEditExistingImage("")
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
            setIsProductDetailsSheetOpen(false)
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
            <Sheet open={isEditProductSheetOpen} onOpenChange={setIsEditProductSheetOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditProductSheet(product)}
                    >
                        Edit
                    </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle className="truncate">Edit {product.name}</SheetTitle>
                        <SheetDescription>
                            Update product details and batch assignment.
                        </SheetDescription>
                    </SheetHeader>
                    <form className="grid gap-6 p-4" onSubmit={submitEditProduct}>
                        {/* Product Details Section */}
                        <div className="space-y-3 border-b pb-4">
                            <h3 className="font-semibold text-sm">Product Details</h3>

                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel htmlFor="edit-product-image">Product image</FieldLabel>
                                </div>
                                <label
                                    htmlFor="edit-product-image"
                                    className="group relative flex h-50 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/60 hover:bg-muted/50"
                                >
                                    {editImagePreview || editExistingImage ? (
                                        <>
                                            <img
                                                src={editImagePreview || editExistingImage}
                                                alt={editProductName}
                                                className="h-full w-full object-cover"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                                                <PencilIcon className="h-8 w-8 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 px-3 text-center">
                                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-background/70 transition-colors group-hover:border-primary/50">
                                                <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                            <div className="text-sm font-medium text-foreground">Add product image</div>
                                            <div className="text-xs text-muted-foreground">Click to upload (PNG, JPG, WEBP)</div>
                                        </div>
                                    )}
                                </label>
                                <Input
                                    id="edit-product-image"
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0]
                                        if (file) {
                                            setEditImageFile(file)
                                        }
                                    }}
                                />
                            </Field>

                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel htmlFor="edit-name">Product name</FieldLabel>
                                    <FieldError className="text-red-400 text-xs">{editErrors.name}</FieldError>
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
                                    <FieldError className="text-red-400 text-xs">{editErrors.externalLink}</FieldError>
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
                                    <FieldError className="text-red-400 text-xs">{editErrors.quantityInitial}</FieldError>
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
                                    <FieldError className="text-red-400 text-xs">{editErrors.unitPriceForeign}</FieldError>
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
                                    <FieldError className="text-red-400 text-xs">{editErrors.sourceCurrency}</FieldError>
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
                                    <FieldError className="text-red-400 text-xs">{editErrors.exchangeRate}</FieldError>
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
                                    <FieldError className="text-red-400 text-xs">{editErrors.batchId}</FieldError>
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
                        <Button type="submit" disabled={isEditSubmitting}>
                            {isEditSubmitting ? "Saving..." : "Save Changes"}
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
                    <Sheet open={isAddProductSheetOpen} onOpenChange={setIsAddProductSheetOpen}>
                        <SheetTrigger asChild>
                            <Button size={"lg"} className="px-6 h-10">Add Product</Button>
                        </SheetTrigger>
                        <SheetContent className="p-0">
                            <div className="flex h-full flex-col">
                                <SheetHeader className="border-b">
                                    <SheetTitle>Add Product</SheetTitle>
                                    <SheetDescription>Create a new product entry.</SheetDescription>
                                </SheetHeader>
                                <form className="flex-1 overflow-y-auto grid gap-3 p-4" onSubmit={submitProduct}>
                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-images">Product image</FieldLabel>
                                        </div>
                                        <label
                                            htmlFor="product-images"
                                            className="group relative flex h-50 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-primary/60 hover:bg-muted/50"
                                        >
                                            {imagePreviews[0] ? (
                                                <img
                                                    src={imagePreviews[0]}
                                                    alt="Selected product preview"
                                                    className="h-full w-full object-cover"
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center gap-2 px-3 text-center">
                                                    <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-background/70 transition-colors group-hover:border-primary/50">
                                                        <ImagePlusIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                                                    </div>
                                                    <div className="text-sm font-medium text-foreground">Add product image</div>
                                                    <div className="text-xs text-muted-foreground">Click to upload (PNG, JPG, WEBP)</div>
                                                </div>
                                            )}
                                        </label>
                                        <Input
                                            id="product-images"
                                            type="file"
                                            multiple
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(event) => {
                                                setImageFiles(Array.from(event.target.files ?? []))
                                            }}
                                        />
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-name">Product name</FieldLabel>
                                            <FieldError className="text-red-400 text-xs">{errors.name}</FieldError>
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
                                            <FieldError className="text-red-400 text-xs">{errors.externalLink}</FieldError>
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
                                            <FieldLabel htmlFor="product-category">Category</FieldLabel>
                                            <FieldError className="text-red-400 text-xs">{errors.categoryId}</FieldError>
                                        </div>
                                        <Select value={categoryId} onValueChange={setCategoryId}>
                                            <SelectTrigger id="product-category">
                                                <SelectValue placeholder="Choose category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem key={category._id} value={category._id}>
                                                        {category.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </Field>

                                    <Field>
                                        <div className="flex items-center justify-between">
                                            <FieldLabel htmlFor="product-quantity">Initial stock</FieldLabel>
                                            <FieldError className="text-red-400 text-xs">{errors.quantityInitial}</FieldError>
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
                                            <FieldError className="text-red-400 text-xs">{errors.unitPriceForeign}</FieldError>
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
                                            <FieldError className="text-red-400 text-xs">{errors.sourceCurrency}</FieldError>
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
                                            <FieldError className="text-red-400 text-xs">{errors.exchangeRate}</FieldError>
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

                                    {errors.general ? <FieldError className="text-red-400 text-xs">{errors.general}</FieldError> : null}

                                    <Button type="submit" disabled={isSubmitting}>
                                        {isSubmitting ? "Saving..." : "Add Product"}
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
                                    <TableHead>Remaining</TableHead>
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
                    <div className="overflow-hidden rounded-xl border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Image</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Remaining</TableHead>
                                    <TableHead>Buying Price (RWF)</TableHead>
                                    <TableHead>Landed Price (RWF)</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => (
                                    <TableRow
                                        key={product._id}
                                        className="cursor-pointer"
                                        onClick={() => openProductDetailsSheet(product)}
                                    >
                                        <TableCell>
                                            {product.images?.[0] ? (
                                                <img
                                                    src={product.images[0]}
                                                    alt={product.name}
                                                    className="h-10 w-10 rounded-md object-cover"
                                                />
                                            ) : (
                                                <div className="h-10 w-10 rounded-md bg-muted" />
                                            )}
                                        </TableCell>
                                        <TableCell className="truncate max-w-xs">{product.name}</TableCell>
                                        <TableCell>{product.categoryId?.name ?? "-"}</TableCell>
                                        <TableCell>{product.batchId?.batchName ?? "Unassigned"}</TableCell>
                                        <TableCell>
                                            <Badge variant={product.quantityRemaining > 0 ? "outline" : "destructive"}>
                                                {product.quantityRemaining}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{product.purchasePriceRWF.toLocaleString()}</TableCell>
                                        <TableCell>{product.landedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell onClick={(event) => event.stopPropagation()}>{renderProductActions(product)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {products.map((product) => (
                            <div
                                key={product._id}
                                className="rounded-lg border bg-card p-4 cursor-pointer"
                                onClick={() => openProductDetailsSheet(product)}
                            >
                                <div className="mb-3 overflow-hidden rounded-md border bg-muted">
                                    {product.images?.[0] ? (
                                        <img
                                            src={product.images[0]}
                                            alt={product.name}
                                            className="h-36 w-full object-cover"
                                        />
                                    ) : (
                                        <div className="h-36 w-full" />
                                    )}
                                </div>
                                <div className="mb-1 truncate text-base font-semibold text-card-foreground">{product.name}</div>
                                <div className="text-sm text-muted-foreground">Category: {product.categoryId?.name ?? "-"}</div>
                                <div className="text-sm text-muted-foreground">Batch: {product.batchId?.batchName ?? "Unassigned"}</div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <Badge variant={product.quantityRemaining > 0 ? "outline" : "destructive"}>
                                        Stock: {product.quantityRemaining}
                                    </Badge>
                                    <Badge variant="secondary">Buying Price: RWF {product.purchasePriceRWF.toLocaleString()}</Badge>
                                </div>
                                <div className="mt-3 text-xs text-muted-foreground">
                                    Landed Price (RWF): {product.landedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                </div>
                                <div className="mt-4" onClick={(event) => event.stopPropagation()}>{renderProductActions(product)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Sheet open={isProductDetailsSheetOpen} onOpenChange={setIsProductDetailsSheetOpen}>
                <SheetContent className="overflow-y-auto">
                    <SheetHeader>
                        <SheetTitle>{detailsProduct?.name ?? "Product details"}</SheetTitle>
                        <SheetDescription>
                            Full product details and quick actions.
                        </SheetDescription>
                    </SheetHeader>

                    {detailsProduct ? (
                        <div className="grid gap-4 p-4">
                            {detailsProduct.images?.[0] ? (
                                <img
                                    src={detailsProduct.images[0]}
                                    alt={detailsProduct.name}
                                    className="aspect-square w-full rounded-md object-cover border"
                                />
                            ) : (
                                <div className="h-44 w-full rounded-md border bg-muted" />
                            )}

                            <div className="grid gap-3 text-sm sm:grid-cols-2">
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Name:</p>
                                    <p className="mt-1 truncate font-medium">{detailsProduct.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Category:</p>
                                    <p className="mt-1 font-medium">{detailsProduct.categoryId?.name ?? "-"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Batch:</p>
                                    <p className="mt-1 font-medium">{detailsProduct.batchId?.batchName ?? "Unassigned"}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Created:</p>
                                    <p className="mt-1 font-medium">{new Date(detailsProduct.createdAt).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Initial stock:</p>
                                    <p className="mt-1 font-medium">{detailsProduct.quantityInitial}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Remaining stock:</p>
                                    <p className="mt-1 font-medium">{detailsProduct.quantityRemaining}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Unit price:</p>
                                    <p className="mt-1 font-medium">{detailsProduct.unitPriceForeign.toLocaleString()} {detailsProduct.sourceCurrency}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Exchange rate:</p>
                                    <p className="mt-1 font-medium">{(detailsProduct.exchangeRate ?? 1).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Buying price (RWF):</p>
                                    <p className="mt-1 font-medium">{detailsProduct.purchasePriceRWF.toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-muted-foreground">Landed cost (RWF):</p>
                                    <p className="mt-1 font-medium">{detailsProduct.landedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsProductDetailsSheetOpen(false)
                                        openEditProductSheet(detailsProduct)
                                    }}
                                >
                                    Edit Product
                                </Button>

                                {detailsProduct.externalLink ? (
                                    <Button asChild type="button" variant="outline">
                                        <a href={detailsProduct.externalLink} target="_blank" rel="noreferrer">
                                            <ExternalLinkIcon className="h-4 w-4" />
                                            External Link
                                        </a>
                                    </Button>
                                ) : (
                                    <Button type="button" variant="outline" disabled>
                                        <ExternalLinkIcon className="h-4 w-4" />
                                        External Link
                                    </Button>
                                )}

                                <Button
                                    type="button"
                                    variant="destructive"
                                    onClick={() => handleDeleteProduct(detailsProduct)}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </SheetContent>
            </Sheet>

            {showSaleModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200"
                    onClick={requestCloseSaleModal}
                >
                    <div
                        className="modal-pop-in bg-white dark:bg-slate-950 rounded-lg shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-800"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <form className="p-6" onSubmit={submitSaleFromModal}>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">
                                    {saleStep === "product" ? "Select Product" : "Record Sale"}
                                </h2>
                                <button
                                    type="button"
                                    onClick={requestCloseSaleModal}
                                    className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
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
                                            <p className="text-sm text-slate-600 dark:text-slate-400 text-center py-4">
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
                                                            ? "cursor-not-allowed opacity-50 border-slate-200 dark:border-slate-800"
                                                            : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                                                            }`}
                                                    >
                                                        <p className="truncate font-medium text-slate-900 dark:text-slate-50">{product.name}</p>
                                                        <p className="text-xs text-slate-600 dark:text-slate-400">
                                                            In stock: {product.quantityRemaining}
                                                            {isOutOfStock ? <span className="ml-2 font-medium text-red-600 dark:text-red-400">(Out of stock)</span> : null}
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
                                        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-2">
                                            {saleSelectedProduct?.name}
                                        </h2>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            Available quantity: <span className="font-semibold text-slate-900 dark:text-slate-50">{saleAvailableQuantity}</span>
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div>
                                            <label className="text-sm font-medium text-slate-900 dark:text-slate-50 block mb-2">
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
                                                <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
                                                    Requested quantity is higher than available stock.
                                                </p>
                                            ) : null}
                                            {saleErrors.quantity ? <FieldError className="text-red-400 text-xs mt-2">{saleErrors.quantity}</FieldError> : null}
                                        </div>

                                        <div>
                                            <label className="text-sm font-medium text-slate-900 dark:text-slate-50 block mb-2">
                                                Selling Price per Unit
                                            </label>
                                            <Input
                                                type="text"
                                                inputMode="decimal"
                                                placeholder="Enter selling price"
                                                value={salePrice}
                                                onChange={(event) => setSalePrice(toDecimalInput(event.target.value))}
                                            />
                                            {saleErrors.sellingPrice ? <FieldError className="text-red-400 text-xs mt-2">{saleErrors.sellingPrice}</FieldError> : null}
                                        </div>

                                        {salePrice ? (
                                            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                                {saleProfitPerUnit > 0 ? (
                                                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                                        Profit: {saleProfitPerUnit.toLocaleString()} RWF per unit
                                                    </p>
                                                ) : saleProfitPerUnit < 0 ? (
                                                    <p className="text-sm font-medium text-red-600 dark:text-red-400">
                                                        Loss: {Math.abs(saleProfitPerUnit).toLocaleString()} RWF per unit
                                                    </p>
                                                ) : (
                                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                                                        Break-even price
                                                    </p>
                                                )}
                                            </div>
                                        ) : null}

                                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Quantity selected: <span className="font-semibold text-slate-900 dark:text-slate-50">{saleSelectedQuantity || 0}</span>
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Landed cost per unit: <span className="font-semibold text-slate-900 dark:text-slate-50">{(saleSelectedProduct?.landedCost ?? 0).toLocaleString()} RWF</span>
                                            </p>
                                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                                Total landed cost: <span className="font-semibold text-slate-900 dark:text-slate-50">{saleTotalLandedCost.toLocaleString()} RWF</span>
                                            </p>
                                        </div>

                                        {saleErrors.general ? <FieldError className="text-red-400 text-xs">{saleErrors.general}</FieldError> : null}
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
                                        <Button type="submit" disabled={!canSubmitSale} className="flex-1 disabled:opacity-40">
                                            {isSaleSubmitting ? "Saving..." : "Record Sale"}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {showDiscardSaleConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
                    <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Discard sale draft?</h3>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
                    <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Delete Product?</h3>
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                            You are about to permanently delete <span className="font-semibold text-slate-900 dark:text-slate-50">&quot;{deleteConfirmData.productName}&quot;</span>.
                        </p>

                        {(deleteConfirmData.hasActiveSales || deleteConfirmData.isInBatch) && (
                            <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                                <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Warning:</p>
                                <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                                    {deleteConfirmData.hasActiveSales && (
                                        <p>• This product has <span className="font-semibold">{deleteConfirmData.salesCount}</span> sale(s) recorded.</p>
                                    )}
                                    {deleteConfirmData.isInBatch && (
                                        <p>• This product is assigned to batch <span className="font-semibold">{deleteConfirmData.batchName}</span>.</p>
                                    )}
                                </div>
                            </div>
                        )}

                        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
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
                                className="gap-2"
                            >
                                {isDeleting ? (
                                    <>
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        Deleting...
                                    </>
                                ) : (
                                    "Delete Permanently"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
