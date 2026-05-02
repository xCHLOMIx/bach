"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  ImagePlusIcon,
  LoaderCircle,
  PencilIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProductEditSheet } from "@/components/product-edit-sheet"
import { Skeleton } from "@/components/ui/skeleton"

type Category = { _id: string; name: string }

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
  intendedSellingPrice?: number | null
  externalLink?: string
  images: string[]
  soldQuantity?: number
  createdAt: string
}

type Batch = { _id: string; batchName: string }

type DeleteConfirmData = {
  productId: string
  productName: string
  hasActiveSales: boolean
  salesCount: number
  isInBatch: boolean
  batchName: string | null
}

function formatNumber(value: number | undefined, options?: Intl.NumberFormatOptions) {
  if (value === undefined || Number.isNaN(value)) {
    return "-"
  }

  return value.toLocaleString(undefined, options)
}

function DetailTile({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 ${emphasis ? "text-2xl font-bold" : "text-base font-semibold"}`}>
        {value}
      </p>
    </div>
  )
}

export default function ProductDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const productId = params.id as string
  const requestedReturnTo = searchParams.get("returnTo")?.trim()
  const returnTo = requestedReturnTo?.startsWith("/app/products") || requestedReturnTo?.startsWith("/app/batches")
    ? requestedReturnTo
    : "/app/products"

  const goBackToProducts = useCallback(() => {
    router.push(returnTo)
  }, [returnTo, router])

  const [product, setProduct] = useState<Product | null>(null)
  const [batches, setBatches] = useState<Batch[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [isEditProductSheetOpen, setIsEditProductSheetOpen] = useState(false)
  const [editProductId, setEditProductId] = useState("")
  const [editProductName, setEditProductName] = useState("")
  const [editQuantityInitial, setEditQuantityInitial] = useState("0")
  const [editUnitPriceForeign, setEditUnitPriceForeign] = useState("0")
  const [editIntendedSellingPrice, setEditIntendedSellingPrice] = useState("")
  const [editExternalLink, setEditExternalLink] = useState("")
  const [editSourceCurrency, setEditSourceCurrency] = useState("USD")
  const [editExchangeRate, setEditExchangeRate] = useState("1")
  const [editBatchId, setEditBatchId] = useState("")
  const [editProductImages, setEditProductImages] = useState<string[]>([])
  const [editNewImages, setEditNewImages] = useState<File[]>([])
  const [editNewImagePreviews, setEditNewImagePreviews] = useState<string[]>([])
  const [editDeletedImageIndices, setEditDeletedImageIndices] = useState<Set<number>>(new Set())
  const [editErrors, setEditErrors] = useState<Record<string, string>>({})
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmData, setDeleteConfirmData] = useState<DeleteConfirmData | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const previewImageSrc = previewImages[previewImageIndex] ?? null
  const isPreviewOpen = previewImages.length > 0

  const openImagePreview = useCallback((images: string[], index: number) => {
    if (images.length === 0) {
      return
    }

    const safeIndex = Math.max(0, Math.min(index, images.length - 1))
    setPreviewImages(images)
    setPreviewImageIndex(safeIndex)
  }, [])

  const closeImagePreview = useCallback(() => {
    setPreviewImages([])
    setPreviewImageIndex(0)
  }, [])

  const showPreviousPreviewImage = useCallback(() => {
    if (previewImages.length < 2) {
      return
    }

    setPreviewImageIndex((current) => (current === 0 ? previewImages.length - 1 : current - 1))
  }, [previewImages.length])

  const showNextPreviewImage = useCallback(() => {
    if (previewImages.length < 2) {
      return
    }

    setPreviewImageIndex((current) => (current === previewImages.length - 1 ? 0 : current + 1))
  }, [previewImages.length])

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

  const loadProduct = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const [productResponse, categoriesResponse, batchesResponse] = await Promise.all([
        fetch(`/api/products/${productId}`),
        fetch("/api/categories"),
        fetch("/api/batches"),
      ])

      if (!productResponse.ok) {
        throw new Error("Product not found")
      }

      const productData = await productResponse.json()
      setProduct(productData.product)
      setCurrentImageIndex(0)

      if (categoriesResponse.ok) {
        const categoryData = await categoriesResponse.json()
        setCategories(categoryData.categories ?? [])
      }

      if (batchesResponse.ok) {
        const batchData = await batchesResponse.json()
        setBatches(batchData.batches ?? [])
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load product")
    } finally {
      setIsLoading(false)
    }
  }, [productId])

  useEffect(() => {
    if (productId) {
      void loadProduct()
    }
  }, [loadProduct, productId])

  useEffect(() => {
    const previews = editNewImages.map((file) => URL.createObjectURL(file))
    setEditNewImagePreviews(previews)

    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [editNewImages])

  useEffect(() => {
    if (editSourceCurrency === "RWF") {
      setEditExchangeRate("1")
    }
  }, [editSourceCurrency])

  // Extract image length to optimize callback dependencies (only depends on actual data being used)
  const imageCount = product?.images?.length ?? 0

  const handlePrevImage = useCallback(() => {
    if (imageCount > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? imageCount - 1 : prev - 1))
    }
  }, [imageCount])

  const handleNextImage = useCallback(() => {
    if (imageCount > 0) {
      setCurrentImageIndex((prev) => (prev === imageCount - 1 ? 0 : prev + 1))
    }
  }, [imageCount])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPreviewOpen) {
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

        return
      }

      if (event.key === "ArrowLeft") handlePrevImage()
      if (event.key === "ArrowRight") handleNextImage()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [closeImagePreview, handleNextImage, handlePrevImage, isPreviewOpen, showNextPreviewImage, showPreviousPreviewImage])

  const openEditProductSheet = useCallback(() => {
    setIsEditProductSheetOpen(true)
  }, [])

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

      setIsEditProductSheetOpen(false)
      await loadProduct()
    } finally {
      setIsEditSubmitting(false)
    }
  }

  const handleDeleteProduct = async (currentProduct: Product) => {
    try {
      const response = await fetch(`/api/products/${currentProduct._id}`, {
        method: "DELETE",
      })

      const data = await response.json()
      if (!response.ok) {
        alert("Failed to get deletion info")
        return
      }

      setDeleteConfirmData({
        productId: currentProduct._id,
        productName: currentProduct.name,
        hasActiveSales: data.deletionInfo.hasActiveSales,
        salesCount: data.deletionInfo.salesCount,
        isInBatch: data.deletionInfo.isInBatch,
        batchName: data.deletionInfo.batchName,
      })
      setShowDeleteConfirm(true)
    } catch (deleteError) {
      console.error(deleteError)
      alert("Failed to get deletion info")
    }
  }

  const confirmDeleteProduct = async () => {
    if (!deleteConfirmData) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/products/${deleteConfirmData.productId}?confirm=true`, {
        method: "DELETE",
      })

      if (!response.ok) {
        alert("Failed to delete product")
        return
      }

      router.push("/app/products")
    } catch (deleteError) {
      console.error(deleteError)
      alert("Failed to delete product")
    } finally {
      setIsDeleting(false)
    }
  }

  const currentImage = product?.images?.[currentImageIndex]

  const hasEditProductChanges = useMemo(() => {
    if (!product || !editProductId) {
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

    const hasDeletedImages = editDeletedImageIndices.size > 0
    const hasNewImages = editNewImages.length > 0
    const existingImagesReordered =
      editProductImages.length !== (product.images?.length ?? 0) ||
      editProductImages.some((image, index) => image !== (product.images?.[index] ?? ""))

    return (
      editProductName.trim() !== product.name.trim() ||
      parsedEditQuantity !== Number(product.quantityInitial ?? 0) ||
      parsedEditUnitPrice !== Number(product.unitPriceForeign ?? 0) ||
      editExternalLink.trim() !== (product.externalLink ?? "").trim() ||
      editSourceCurrency !== product.sourceCurrency ||
      (editSourceCurrency === "RWF" ? 1 : parsedEditExchangeRate) !== parsedOriginalExchangeRate ||
      (editBatchId || "") !== (product.batchId?._id ?? "") ||
      sellingPriceChanged ||
      hasDeletedImages ||
      hasNewImages ||
      existingImagesReordered
    )
  }, [
    editBatchId,
    editDeletedImageIndices,
    editExchangeRate,
    editExternalLink,
    editIntendedSellingPrice,
    editNewImages,
    editProductId,
    editProductImages,
    editProductName,
    editQuantityInitial,
    editSourceCurrency,
    editUnitPriceForeign,
    product,
  ])

  const soldCount = useMemo(() => {
    if (!product) {
      return 0
    }

    return typeof product.soldQuantity === "number" ? product.soldQuantity : 0
  }, [product])

  const intendedSellingPrice = useMemo(() => {
    if (!product?._id) {
      return undefined
    }

    return product.intendedSellingPrice
  }, [product?._id, product?.intendedSellingPrice, isEditProductSheetOpen])

  const intendedProfitPerUnit = useMemo(() => {
    if (!product || typeof intendedSellingPrice !== "number") {
      return undefined
    }

    return intendedSellingPrice - product.landedCost
  }, [intendedSellingPrice, product])

  if (isLoading) {
    return (
      <div className="flex-1 p-4 lg:p-6">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" className="h-9 w-9 p-0" onClick={goBackToProducts}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Skeleton className="h-5 w-32" />
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div className="grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)]">
            <div className="flex gap-3 lg:flex-col">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-20 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="aspect-[4/4.2] w-full rounded-[2rem]" />
          </div>

          <div className="space-y-4">
            <Skeleton className="h-10 w-4/5 rounded-xl" />
            <Skeleton className="h-6 w-48 rounded-xl" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
            <Skeleton className="h-48 rounded-[2rem]" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="flex-1 p-4 lg:p-6">
        <Button variant="outline" onClick={goBackToProducts}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="mt-8 text-center">
          <p className="text-destructive">{error || "Product not found"}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-4 lg:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="h-9 w-9 p-0" onClick={goBackToProducts}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="text-sm font-medium text-muted-foreground">Back to Products</p>
        </div>

        <div className="flex items-center gap-2">
          {product.externalLink ? (
            <Button asChild className="h-9 w-9 rounded-xl p-0 sm:w-auto sm:px-3">
              <a href={product.externalLink} target="_blank" rel="noopener noreferrer" aria-label="External Link">
                <span className="hidden sm:inline">External Link</span>
                <ExternalLinkIcon className="h-4 w-4 sm:ml-2" />
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="h-9 w-9 rounded-xl p-0 sm:w-auto sm:px-3"
              aria-label="External Link"
              disabled
            >
              <span className="hidden sm:inline">External Link</span>
              <ExternalLinkIcon className="h-4 w-4 sm:ml-2" />
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 rounded-xl p-0 sm:w-auto sm:px-3"
            onClick={openEditProductSheet}
            aria-label="Edit Product"
          >
            <span className="hidden sm:inline">Edit Product</span>
            <PencilIcon className="h-4 w-4 sm:ml-2" />
          </Button>

          <Button
            type="button"
            variant="destructive"
            className="h-9 w-9 rounded-xl p-0 sm:w-auto sm:px-3"
            onClick={() => void handleDeleteProduct(product)}
            aria-label="Delete Product"
          >
            <span className="hidden sm:inline">Delete</span>
            <Trash2Icon className="h-4 w-4 sm:ml-2" />
          </Button>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="grid gap-4 lg:grid-cols-[96px_minmax(0,1fr)]">
          <div className="order-2 flex gap-3 overflow-x-auto pb-2 lg:order-1 lg:max-h-168 lg:flex-col lg:overflow-y-auto lg:pb-0">
            {(product.images.length > 0 ? product.images : [product.name]).map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setCurrentImageIndex(index)}
                className={`relative h-20 aspect-square overflow-hidden rounded-2xl border transition-all ${index === currentImageIndex
                  ? "border-foreground"
                  : "border-border/70 bg-muted/30 hover:border-foreground/40"
                  }`}
              >
                {product.images[index] ? (
                  <Image
                    src={product.images[index]}
                    alt={`${product.name} thumbnail ${index + 1}`}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted px-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    {product.name.slice(0, 8)}
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="order-1 overflow-hidden rounded-[2rem] border border-border/70 h-max p-4 bg-gray-100 lg:order-2">
            <div className="relative aspect-[4/4.2] overflow-hidden rounded-[1.5rem] bg-white">
              {currentImage ? (
                <button
                  type="button"
                  className="absolute inset-0 cursor-zoom-in"
                  onClick={() => openImagePreview(product.images.length > 0 ? product.images : [currentImage], product.images.length > 0 ? currentImageIndex : 0)}
                >
                  <Image
                    src={currentImage}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 1280px) 100vw, 55vw"
                    className="object-contain p-6"
                  />
                </button>
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-muted">
                  <div className="text-center">
                    <div className="text-5xl font-bold tracking-[0.25em] text-muted-foreground">
                      {product.name.replace(/\s+/g, "").slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                </div>
              )}

              {product.images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-3 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-2xl bg-black/45 text-white transition hover:bg-black/65"
                    title="Previous image"
                  >
                    <ChevronLeftIcon className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-3 top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-2xl bg-black/45 text-white transition hover:bg-black/65"
                    title="Next image"
                  >
                    <ChevronRightIcon className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[2rem] border border-border/70 bg-background/95 p-6 shadow-[0_24px_70px_-55px_rgba(15,23,42,0.7)]">
            <div className="flex flex-wrap items-center gap-2">
              {product.quantityRemaining > 0 ? (
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold">
                  {product.quantityRemaining} in stock
                </Badge>
              ) : (
                <Badge variant="destructive" className="rounded-full px-3 py-1 text-xs font-semibold">
                  Out of stock
                </Badge>
              )}
              {product.categoryId?.name ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                  {product.categoryId.name}
                </Badge>
              ) : null}
              {product.batchId?.batchName ? (
                <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs font-semibold">
                  Batch: {product.batchId.batchName}
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-4 text-xl font-semibold tracking-tight sm:text-2xl">{product.name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              Review pricing, inventory, and sourcing details in one place.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <DetailTile
                label="Landed Cost"
                value={`${formatNumber(product.landedCost, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} RWF`}
              // emphasis
              />
              <DetailTile
                label="Selling Price"
                value={typeof intendedSellingPrice === "number"
                  ? `${formatNumber(intendedSellingPrice, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} RWF`
                  : "-"}
              />
              <DetailTile
                label="Intended Profit / Unit"
                value={typeof intendedProfitPerUnit === "number"
                  ? `${formatNumber(intendedProfitPerUnit, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} RWF`
                  : "-"}
              />
              <DetailTile
                label="Unit Price"
                value={`${formatNumber(product.unitPriceForeign, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${product.sourceCurrency}`}
              />
              <DetailTile
                label="Unit Price in RWF"
                value={`${formatNumber(product.unitPriceLocalRWF, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} RWF`}
              />
              <DetailTile
                label="Exchange Rate"
                value={
                  product.exchangeRate
                    ? formatNumber(product.exchangeRate, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })
                    : "-"
                }
              />
              <DetailTile label="Initial Stock" value={formatNumber(product.quantityInitial)} />
              <DetailTile label="Remaining Stock" value={formatNumber(product.quantityRemaining)} />
              <DetailTile label="Sold" value={formatNumber(soldCount)} />
              <DetailTile
                label="Added"
                value={new Date(product.createdAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              />
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-border/60 bg-muted/20 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Product Summary</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Category</p>
                  <p className="mt-1 text-base font-semibold">{product.categoryId?.name ?? "Uncategorized"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Batch</p>
                  <p className="mt-1 text-base font-semibold">{product.batchId?.batchName ?? "No batch assigned"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Purchase Price</p>
                  <p className="mt-1 text-base font-semibold">
                    {formatNumber(product.purchasePriceRWF, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    RWF
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Source Currency</p>
                  <p className="mt-1 text-base font-semibold">{product.sourceCurrency}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <ProductEditSheet
        open={isEditProductSheetOpen && Boolean(product)}
        onOpenChange={setIsEditProductSheetOpen}
        product={product}
        categories={categories}
        batches={batches}
        onSaved={async () => {
          await loadProduct()
        }}
      />

      {showDeleteConfirm && deleteConfirmData ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-lg font-semibold text-destructive">Delete Product?</h3>
            <p className="mt-3 text-sm text-muted-foreground">
              You are about to permanently delete{" "}
              <span className="font-semibold text-foreground">&quot;{deleteConfirmData.productName}&quot;</span>.
            </p>

            {deleteConfirmData.hasActiveSales || deleteConfirmData.isInBatch ? (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900 dark:bg-yellow-950">
                <p className="mb-2 text-sm font-semibold text-accent-foreground">Warning:</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  {deleteConfirmData.hasActiveSales ? (
                    <li>
                      This product has <span className="font-semibold">{deleteConfirmData.salesCount}</span> sale(s)
                      recorded.
                    </li>
                  ) : null}
                  {deleteConfirmData.isInBatch ? (
                    <li>
                      This product is assigned to batch{" "}
                      <span className="font-semibold">{deleteConfirmData.batchName}</span>.
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <p className="mt-4 text-xs text-muted-foreground">This action cannot be undone.</p>

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
              <Button type="button" variant="destructive" onClick={confirmDeleteProduct} disabled={isDeleting}>
                {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : "Delete Permanently"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {previewImageSrc ? (
        <div
          className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-4"
          onClick={closeImagePreview}
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
        >
          {previewImages.length > 1 ? (
            <button
              type="button"
              className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
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
            className="absolute right-4 top-4 rounded-md bg-black/70 p-2 text-white hover:bg-black"
            onClick={closeImagePreview}
          >
            <XIcon className="h-5 w-5" />
          </button>

          {previewImages.length > 1 ? (
            <button
              type="button"
              className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
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
