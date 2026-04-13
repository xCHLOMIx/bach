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
import { AddProductSheet } from "@/components/add-product-sheet"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ChevronUpIcon, Columns3Icon, ImagePlusIcon, LayoutGridIcon, ListIcon, PackageSearchIcon, SearchIcon, ShoppingCartIcon, Trash2Icon, XIcon } from "lucide-react"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"
import { getAllIntendedSellingPrices } from "@/lib/intended-pricing"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const SOURCE_CURRENCY_OPTIONS = ["USD", "RWF", "CNY", "AED"]
const NO_CATEGORY_VALUE = "__none__"
const PRODUCTS_VIEW_MODE_STORAGE_KEY = "products:view-mode"
const PRODUCTS_VISIBLE_COLUMNS_STORAGE_KEY = "products:visible-columns"
const PRODUCTS_TABLE_STATE_STORAGE_KEY = "products:table-state"
const PRODUCTS_COLUMN_ORDER_STORAGE_KEY = "products:column-order"

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
    intendedSellingPrice?: number | null
    createdAt: string
}

type ProductTableColumnKey =
    | "image"
    | "name"
    | "batch"
    | "added"
    | "onHand"
    | "buyingPrice"
    | "sellingPrice"
    | "landedPrice"
    | "profit"

type ProductSortColumn = Exclude<ProductTableColumnKey, "image">
type ProductSortDirection = "asc" | "desc"

const DEFAULT_PRODUCT_COLUMN_ORDER: ProductTableColumnKey[] = [
    "image",
    "name",
    "batch",
    "added",
    "onHand",
    "buyingPrice",
    "landedPrice",
    "sellingPrice",
    "profit",
]

type BulkSaleRow = {
    productId: string
    name: string
    availableQuantity: number
    landedCost: number
    quantity: string
    sellingPrice: string
}

type BulkSaleRowErrors = Record<string, { quantity?: string; sellingPrice?: string }>

type EditImageItem = {
    id: string
    type: "existing" | "new"
    src: string
    file?: File
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

export function ProductsPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [products, setProducts] = React.useState<Product[]>([])
    const [categories, setCategories] = React.useState<Category[]>([])
    const [batches, setBatches] = React.useState<Batch[]>([])
    const [hasLoadedFormOptions, setHasLoadedFormOptions] = React.useState(false)
    const [isLoading, setIsLoading] = React.useState(true)
    const [viewMode, setViewMode] = React.useState<"list" | "grid">("list")
    const [isAddProductSheetOpen, setIsAddProductSheetOpen] = React.useState(false)
    const [isEditProductSheetOpen, setIsEditProductSheetOpen] = React.useState(false)
    const [selectedProductIds, setSelectedProductIds] = React.useState<Set<string>>(new Set())
    const [visibleColumns, setVisibleColumns] = React.useState<Record<ProductTableColumnKey, boolean>>({
        image: true,
        name: true,
        batch: true,
        added: true,
        onHand: true,
        buyingPrice: true,
        sellingPrice: true,
        landedPrice: true,
        profit: true,
    })
    const [columnOrder, setColumnOrder] = React.useState<ProductTableColumnKey[]>(DEFAULT_PRODUCT_COLUMN_ORDER)
    const [draggedColumn, setDraggedColumn] = React.useState<ProductTableColumnKey | null>(null)
    const [sortColumn, setSortColumn] = React.useState<ProductSortColumn>("name")
    const [sortDirection, setSortDirection] = React.useState<ProductSortDirection>("asc")
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [productSearch, setProductSearch] = React.useState("")
    const [productSearchInput, setProductSearchInput] = React.useState("")

    const [productName, setProductName] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("")
    const [isAddingCustomCategory, setIsAddingCustomCategory] = React.useState(false)
    const [customCategoryName, setCustomCategoryName] = React.useState("")
    const [quantityInitial, setQuantityInitial] = React.useState("")
    const [unitPriceForeign, setUnitPriceForeign] = React.useState("")
    const [productExternalLink, setProductExternalLink] = React.useState("")
    const [sourceCurrency, setSourceCurrency] = React.useState("USD")
    const [exchangeRate, setExchangeRate] = React.useState("")
    const [imageFiles, setImageFiles] = React.useState<File[]>([])
    const [imagePreviews, setImagePreviews] = React.useState<string[]>([])
    const [draggedAddImageIndex, setDraggedAddImageIndex] = React.useState<number | null>(null)

    const [showSaleModal, setShowSaleModal] = React.useState(false)
    const [showDiscardSaleConfirm, setShowDiscardSaleConfirm] = React.useState(false)
    const [saleStep, setSaleStep] = React.useState<"product" | "details" | "bulk-details">("product")
    const [saleMode, setSaleMode] = React.useState<"single" | "bulk">("single")
    const [saleSelectedProduct, setSaleSelectedProduct] = React.useState<Product | null>(null)
    const [saleQuantity, setSaleQuantity] = React.useState("")
    const [salePrice, setSalePrice] = React.useState("")
    const [bulkSaleRows, setBulkSaleRows] = React.useState<BulkSaleRow[]>([])
    const [bulkSaleRowErrors, setBulkSaleRowErrors] = React.useState<BulkSaleRowErrors>({})
    const [bulkSaleGeneralError, setBulkSaleGeneralError] = React.useState("")
    const [saleProductSearch, setSaleProductSearch] = React.useState("")
    const [saleErrors, setSaleErrors] = React.useState<Record<string, string>>({})
    const [isSaleSubmitting, setIsSaleSubmitting] = React.useState(false)

    const [editProductId, setEditProductId] = React.useState("")
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

    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false)
    const [deleteConfirmData, setDeleteConfirmData] = React.useState<{
        productId: string
        productName: string
        hasActiveSales: boolean
        salesCount: number
        isInBatch: boolean
        batchName: string | null
    } | null>(null)
    const [isDeleteInfoLoading, setIsDeleteInfoLoading] = React.useState(false)
    const [isDeleting, setIsDeleting] = React.useState(false)
    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = React.useState(false)
    const [isBulkDeleteInfoLoading, setIsBulkDeleteInfoLoading] = React.useState(false)
    const [bulkDeleteWarningSummary, setBulkDeleteWarningSummary] = React.useState({
        productsWithSales: 0,
        productsInBatches: 0,
        totalSalesRecords: 0,
    })
    const [isBulkDeleting, setIsBulkDeleting] = React.useState(false)
    const [bulkDeleteError, setBulkDeleteError] = React.useState("")
    const [previewImages, setPreviewImages] = React.useState<string[]>([])
    const [previewImageIndex, setPreviewImageIndex] = React.useState(0)
    const previewImageSrc = previewImages[previewImageIndex] ?? null
    const isPreviewOpen = previewImages.length > 0
    const editGeneratedObjectUrlsRef = React.useRef<string[]>([])
    const productSearchInputRef = React.useRef<HTMLInputElement | null>(null)
    const hasHydratedSearchSortRef = React.useRef(false)

    // Filter and pagination state
    const [isFilterSheetOpen, setIsFilterSheetOpen] = React.useState(false)
    const [filterPriceMin, setFilterPriceMin] = React.useState("")
    const [filterPriceMax, setFilterPriceMax] = React.useState("")
    const [filterCategories, setFilterCategories] = React.useState<Set<string>>(new Set())
    const [filterBatches, setFilterBatches] = React.useState<Set<string>>(new Set())
    const [currentPage, setCurrentPage] = React.useState(1)
    const [totalCount, setTotalCount] = React.useState(0)
    const itemsPerPage = 60
    const totalPages = Math.ceil(totalCount / itemsPerPage)

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

    const toSelectedFiles = (event: React.ChangeEvent<HTMLInputElement>) =>
        Array.from(event.target.files ?? [])

    const reorderAddImageFiles = React.useCallback((toIndex: number) => {
        setImageFiles((current) => {
            if (draggedAddImageIndex === null) {
                return current
            }

            return moveItem(current, draggedAddImageIndex, toIndex)
        })

        setDraggedAddImageIndex(null)
    }, [draggedAddImageIndex])

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

    const canSubmitAddProduct =
        Boolean(productName.trim()) &&
        Boolean(quantityInitial.trim()) &&
        Boolean(unitPriceForeign.trim()) &&
        (sourceCurrency === "RWF" || Boolean(exchangeRate.trim()))

    const canSubmitEditProduct =
        Boolean(editProductName.trim()) &&
        Boolean(editQuantityInitial.trim()) &&
        Boolean(editUnitPriceForeign.trim()) &&
        (editSourceCurrency === "RWF" || Boolean(editExchangeRate.trim()))

    const stripCommas = (value: string) => value.replace(/,/g, "")

    const originalEditProduct = React.useMemo(
        () => products.find((product) => product._id === editProductId),
        [products, editProductId]
    )

    const hasEditProductChanges = React.useMemo(() => {
        if (!editProductId || !originalEditProduct) {
            return false
        }

        const parsedEditQuantity = Number(stripCommas(editQuantityInitial) || 0)
        const parsedEditUnitPrice = Number(stripCommas(editUnitPriceForeign) || 0)
        const parsedEditExchangeRate = Number(stripCommas(editExchangeRate || "1") || 1)
        const parsedOriginalExchangeRate = Number(originalEditProduct.exchangeRate ?? 1)

        const parsedEditSellingPrice = editIntendedSellingPrice.trim()
            ? Number(stripCommas(editIntendedSellingPrice))
            : null
        const parsedOriginalSellingPrice = originalEditProduct?.intendedSellingPrice ?? undefined
        const sellingPriceChanged = parsedEditSellingPrice === null
            ? typeof parsedOriginalSellingPrice === "number"
            : parsedEditSellingPrice !== parsedOriginalSellingPrice

        const existingImageSources = editImages
            .filter((image) => image.type === "existing")
            .map((image) => image.src)
        const originalImageSources = originalEditProduct.images ?? []
        const hasNewImages = editImages.some((image) => image.type === "new")
        const existingImagesChanged =
            existingImageSources.length !== originalImageSources.length ||
            existingImageSources.some((src, index) => src !== originalImageSources[index])

        return (
            editProductName.trim() !== originalEditProduct.name.trim() ||
            (editCategoryId || "") !== (originalEditProduct.categoryId?._id ?? "") ||
            parsedEditQuantity !== Number(originalEditProduct.quantityInitial ?? 0) ||
            parsedEditUnitPrice !== Number(originalEditProduct.unitPriceForeign ?? 0) ||
            editExternalLink.trim() !== (originalEditProduct.externalLink ?? "").trim() ||
            editSourceCurrency !== originalEditProduct.sourceCurrency ||
            (editSourceCurrency === "RWF" ? 1 : parsedEditExchangeRate) !== parsedOriginalExchangeRate ||
            (editBatchId || "") !== (originalEditProduct.batchId?._id ?? "") ||
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
        editProductId,
        editProductName,
        editQuantityInitial,
        editSourceCurrency,
        editUnitPriceForeign,
        originalEditProduct,
    ])

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

    const getApiSortColumn = React.useCallback((column: ProductSortColumn) => {
        switch (column) {
            case "name":
                return "name"
            case "batch":
                return "batchId"
            case "added":
                return "createdAt"
            case "onHand":
                return "quantityRemaining"
            case "buyingPrice":
                return "purchasePriceRWF"
            case "sellingPrice":
                return "intendedSellingPrice"
            case "landedPrice":
                return "landedCost"
            case "profit":
                // Profit is derived client-side in current implementation.
                return "name"
            default:
                return "name"
        }
    }, [])

    const loadProducts = React.useCallback(async (page: number = 1, searchValue?: string) => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("page", page.toString())
            params.set("limit", itemsPerPage.toString())
            params.set("search", searchValue ?? productSearch)

            if (filterPriceMin) params.set("priceMin", stripCommas(filterPriceMin))
            if (filterPriceMax) params.set("priceMax", stripCommas(filterPriceMax))
            if (filterCategories.size > 0) params.set("categories", Array.from(filterCategories).join(","))
            if (filterBatches.size > 0) params.set("batches", Array.from(filterBatches).join(","))

            params.set("sortColumn", getApiSortColumn(sortColumn))
            params.set("sortDirection", sortDirection)

            const productsResponse = await fetch(`/api/products?${params.toString()}`)

            if (productsResponse.ok) {
                const productsData = await productsResponse.json()
                setProducts(productsData.products ?? [])
                setTotalCount(productsData.totalCount ?? 0)
                setCurrentPage(page)
            }
        } finally {
            setIsLoading(false)
        }
    }, [productSearch, filterPriceMin, filterPriceMax, filterCategories, filterBatches, sortColumn, sortDirection, itemsPerPage, getApiSortColumn])

    // Apply filters with current state values - plain function, not memoized
    const applyFilters = async () => {
        setIsLoading(true)
        try {
            const params = new URLSearchParams()
            params.set("page", "1")
            params.set("limit", itemsPerPage.toString())
            params.set("search", productSearch)

            if (filterPriceMin) params.set("priceMin", stripCommas(filterPriceMin))
            if (filterPriceMax) params.set("priceMax", stripCommas(filterPriceMax))
            if (filterCategories.size > 0) params.set("categories", Array.from(filterCategories).join(","))
            if (filterBatches.size > 0) params.set("batches", Array.from(filterBatches).join(","))

            params.set("sortColumn", getApiSortColumn(sortColumn))
            params.set("sortDirection", sortDirection)

            const productsResponse = await fetch(`/api/products?${params.toString()}`)

            if (productsResponse.ok) {
                const productsData = await productsResponse.json()
                setProducts(productsData.products ?? [])
                setTotalCount(productsData.totalCount ?? 0)
                setCurrentPage(1)
                setIsFilterSheetOpen(false)
            }
        } finally {
            setIsLoading(false)
        }
    }

    const loadFormOptions = React.useCallback(async () => {
        const [categoriesResponse, batchesResponse] = await Promise.all([
            fetch("/api/categories"),
            fetch("/api/batches"),
        ])

        let hasAnyOptionsLoaded = false

        if (categoriesResponse.ok) {
            const categoriesData = await categoriesResponse.json()
            setCategories(categoriesData.categories ?? [])
            hasAnyOptionsLoaded = true
        }

        if (batchesResponse.ok) {
            const batchesData = await batchesResponse.json()
            setBatches(batchesData.batches ?? [])
            hasAnyOptionsLoaded = true
        }

        if (hasAnyOptionsLoaded) {
            setHasLoadedFormOptions(true)
        }
    }, [])

    const ensureFormOptionsLoaded = React.useCallback(async () => {
        if (hasLoadedFormOptions) {
            return
        }

        await loadFormOptions()
    }, [hasLoadedFormOptions, loadFormOptions])

    const openAddProductSheet = React.useCallback(() => {
        setIsAddProductSheetOpen(true)
    }, [])

    const handleAddProductSheetOpenChange = React.useCallback((open: boolean) => {
        setIsAddProductSheetOpen(open)
    }, [])

    const handleEditProductSheetOpenChange = React.useCallback((open: boolean) => {
        if (!open && isPreviewOpen) {
            return
        }

        if (open) {
            void ensureFormOptionsLoaded()
        } else {
            setEditIntendedSellingPrice("")
        }

        setIsEditProductSheetOpen(open)
    }, [ensureFormOptionsLoaded, isPreviewOpen])

    React.useEffect(() => {
        if (isFilterSheetOpen) {
            void ensureFormOptionsLoaded()
        }
    }, [isFilterSheetOpen, ensureFormOptionsLoaded])

    React.useEffect(() => {
        loadProducts(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Trigger reload when sort changes.
    React.useEffect(() => {
        if (!hasHydratedSearchSortRef.current) {
            hasHydratedSearchSortRef.current = true
            return
        }

        void loadProducts(1)
    }, [sortColumn, sortDirection, loadProducts])

    React.useEffect(() => {
        const savedViewMode = window.localStorage.getItem(PRODUCTS_VIEW_MODE_STORAGE_KEY)
        if (savedViewMode === "list" || savedViewMode === "grid") {
            setViewMode(savedViewMode)
        }
    }, [])

    React.useEffect(() => {
        const savedVisibleColumnsRaw = window.localStorage.getItem(PRODUCTS_VISIBLE_COLUMNS_STORAGE_KEY)
        if (!savedVisibleColumnsRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedVisibleColumnsRaw) as Partial<Record<ProductTableColumnKey, boolean>>
            setVisibleColumns((current) => ({
                ...current,
                image: typeof parsed.image === "boolean" ? parsed.image : current.image,
                name: typeof parsed.name === "boolean" ? parsed.name : current.name,
                batch: typeof parsed.batch === "boolean" ? parsed.batch : current.batch,
                added: typeof parsed.added === "boolean" ? parsed.added : current.added,
                onHand: typeof parsed.onHand === "boolean" ? parsed.onHand : current.onHand,
                buyingPrice: typeof parsed.buyingPrice === "boolean" ? parsed.buyingPrice : current.buyingPrice,
                sellingPrice: typeof parsed.sellingPrice === "boolean" ? parsed.sellingPrice : current.sellingPrice,
                landedPrice: typeof parsed.landedPrice === "boolean" ? parsed.landedPrice : current.landedPrice,
                profit: typeof parsed.profit === "boolean" ? parsed.profit : current.profit,
            }))
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(PRODUCTS_VIEW_MODE_STORAGE_KEY, viewMode)
    }, [viewMode])

    React.useEffect(() => {
        window.localStorage.setItem(PRODUCTS_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
    }, [visibleColumns])

    React.useEffect(() => {
        const savedColumnOrderRaw = window.localStorage.getItem(PRODUCTS_COLUMN_ORDER_STORAGE_KEY)
        if (!savedColumnOrderRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedColumnOrderRaw)
            if (!Array.isArray(parsed)) {
                return
            }

            const validKeys = parsed.filter((key): key is ProductTableColumnKey =>
                DEFAULT_PRODUCT_COLUMN_ORDER.includes(key as ProductTableColumnKey)
            )

            if (validKeys.length === 0) {
                return
            }

            const mergedOrder = validKeys.includes("onHand")
                ? [
                    ...validKeys,
                    ...DEFAULT_PRODUCT_COLUMN_ORDER.filter((key) => !validKeys.includes(key)),
                ]
                : [...DEFAULT_PRODUCT_COLUMN_ORDER]

            setColumnOrder(mergedOrder)
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(PRODUCTS_COLUMN_ORDER_STORAGE_KEY, JSON.stringify(columnOrder))
    }, [columnOrder])

    React.useEffect(() => {
        const savedTableStateRaw = window.localStorage.getItem(PRODUCTS_TABLE_STATE_STORAGE_KEY)
        if (!savedTableStateRaw) {
            return
        }

        try {
            const parsed = JSON.parse(savedTableStateRaw) as {
                productSearch?: string
                sortColumn?: ProductSortColumn
                sortDirection?: ProductSortDirection
            }

            const sortableColumns: ProductSortColumn[] = [
                "name",
                "batch",
                "added",
                "onHand",
                "buyingPrice",
                "sellingPrice",
                "landedPrice",
                "profit",
            ]

            if (typeof parsed.productSearch === "string") {
                setProductSearch(parsed.productSearch)
                setProductSearchInput(parsed.productSearch)
            }
            if (parsed.sortColumn && sortableColumns.includes(parsed.sortColumn)) {
                setSortColumn(parsed.sortColumn)
            }
            if (parsed.sortDirection === "asc" || parsed.sortDirection === "desc") {
                setSortDirection(parsed.sortDirection)
            }
        } catch {
            // Ignore invalid saved preferences.
        }
    }, [])

    React.useEffect(() => {
        window.localStorage.setItem(
            PRODUCTS_TABLE_STATE_STORAGE_KEY,
            JSON.stringify({
                productSearch,
                sortColumn,
                sortDirection,
            })
        )
    }, [productSearch, sortColumn, sortDirection])

    React.useEffect(() => {
        const previews = imageFiles.map((file) => URL.createObjectURL(file))
        setImagePreviews(previews)

        return () => {
            previews.forEach((url) => URL.revokeObjectURL(url))
        }
    }, [imageFiles])

    React.useEffect(() => {
        if (sourceCurrency === "RWF") {
            setExchangeRate("")
        }
    }, [sourceCurrency])

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

    React.useEffect(() => {
        const handleSearchShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "f") {
                return
            }

            event.preventDefault()
            setViewMode("list")

            requestAnimationFrame(() => {
                productSearchInputRef.current?.focus()
                productSearchInputRef.current?.select()
            })
        }

        window.addEventListener("keydown", handleSearchShortcut)
        return () => window.removeEventListener("keydown", handleSearchShortcut)
    }, [])

    const submitProduct = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
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

            toast.success("Product created")

            setProductName("")
            setCategoryId("")
            setIsAddingCustomCategory(false)
            setCustomCategoryName("")
            setQuantityInitial("")
            setUnitPriceForeign("")
            setProductExternalLink("")
            setSourceCurrency("USD")
            setExchangeRate("")
            setImageFiles([])
            setIsAddProductSheetOpen(false)
            await loadProducts(1)
        } finally {
            setIsSubmitting(false)
        }
    }

    const openEditProductSheet = React.useCallback((product: Product) => {
        void ensureFormOptionsLoaded()
        clearEditImages()
        setEditProductId(product._id)
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
        setIsEditProductSheetOpen(true)
    }, [clearEditImages, ensureFormOptionsLoaded])

    const resetSaleDraft = () => {
        setSaleStep("product")
        setSaleMode("single")
        setSaleSelectedProduct(null)
        setSaleQuantity("")
        setSalePrice("")
        setBulkSaleRows([])
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
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
    }, [searchParams, pathname, router, openAddProductSheet])

    React.useEffect(() => {
        if (searchParams.get("quickSale") !== "1") {
            return
        }

        setSaleStep("product")
        setSaleMode("single")
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
        setSaleMode("single")
        setSaleSelectedProduct(product)
        setSalePrice(formatDecimalWithCommas(String(product.landedCost)))
        setSaleQuantity("")
        setSaleStep("details")
        setSaleErrors({})
        setBulkSaleRows([])
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
        setShowSaleModal(true)
    }

    const openBulkSaleModalForProducts = React.useCallback((productsToSell: Product[]) => {
        const rows = productsToSell
            .filter((product) => product.quantityRemaining > 0)
            .map((product) => ({
                productId: product._id,
                name: product.name,
                availableQuantity: product.quantityRemaining,
                landedCost: product.landedCost,
                quantity: "",
                sellingPrice: formatDecimalWithCommas(String(product.landedCost)),
            }))

        if (rows.length === 0) {
            return
        }

        setSaleMode("bulk")
        setSaleSelectedProduct(null)
        setSaleQuantity("")
        setSalePrice("")
        setSaleStep("bulk-details")
        setSaleErrors({})
        setSaleProductSearch("")
        setBulkSaleRows(rows)
        setBulkSaleRowErrors({})
        setBulkSaleGeneralError("")
        setShowSaleModal(true)
    }, [])

    const hasUnsavedSaleDraft =
        Boolean(saleSelectedProduct) ||
        Boolean(saleQuantity) ||
        Boolean(saleProductSearch) ||
        bulkSaleRows.some((row) => Boolean(row.quantity) || Boolean(row.sellingPrice))

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

        if (saleMode === "bulk") {
            setIsSaleSubmitting(true)
            setBulkSaleRowErrors({})
            setBulkSaleGeneralError("")

            const nextRowErrors: BulkSaleRowErrors = {}

            for (const row of bulkSaleRows) {
                const quantity = Number(row.quantity || 0)
                const sellingPrice = Number(stripCommas(row.sellingPrice) || 0)

                if (!Number.isFinite(quantity) || quantity <= 0) {
                    nextRowErrors[row.productId] = {
                        ...(nextRowErrors[row.productId] ?? {}),
                        quantity: "Quantity must be greater than 0",
                    }
                } else if (quantity > row.availableQuantity) {
                    nextRowErrors[row.productId] = {
                        ...(nextRowErrors[row.productId] ?? {}),
                        quantity: "Requested quantity is higher than available stock",
                    }
                }

                if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
                    nextRowErrors[row.productId] = {
                        ...(nextRowErrors[row.productId] ?? {}),
                        sellingPrice: "Selling price must be 0 or higher",
                    }
                }
            }

            if (Object.keys(nextRowErrors).length > 0) {
                setBulkSaleRowErrors(nextRowErrors)
                setIsSaleSubmitting(false)
                return
            }

            try {
                const failedProducts: string[] = []

                for (const row of bulkSaleRows) {
                    const response = await fetch("/api/sales", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            productId: row.productId,
                            quantity: Number(row.quantity),
                            sellingPrice: Number(stripCommas(row.sellingPrice)),
                        }),
                    })

                    if (!response.ok) {
                        failedProducts.push(row.name)
                    }
                }

                if (failedProducts.length > 0) {
                    setBulkSaleGeneralError(`Failed to record sale for: ${failedProducts.join(", ")}`)
                    return
                }

                toast.success("Sales recorded")

                setShowSaleModal(false)
                resetSaleDraft()
                setSelectedProductIds(new Set())
                await loadProducts(1)
                return
            } finally {
                setIsSaleSubmitting(false)
            }
        }

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

            toast.success("Sale recorded")

            setShowSaleModal(false)
            resetSaleDraft()
            setSelectedProductIds(new Set())
            await loadProducts(1)
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
                    if (createCategoryData.category?._id && createCategoryData.category?.name) {
                        setCategories((current) => [createCategoryData.category, ...current])
                    }
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

            const response = await fetch(`/api/products/${editProductId}`, {
                method: "PATCH",
                body: formData,
            })

            const data = await response.json()
            if (!response.ok) {
                setEditErrors(data.errors ?? { general: "Failed to update product" })
                return
            }

            toast.success("Product updated")

            setEditProductId("")
            setEditProductName("")
            setEditCategoryId("")
            setIsAddingEditCustomCategory(false)
            setEditCustomCategoryName("")
            setEditQuantityInitial("")
            setEditUnitPriceForeign("")
            setEditIntendedSellingPrice("")
            setEditExternalLink("")
            setEditSourceCurrency("USD")
            setEditExchangeRate("")
            setEditBatchId("")
            clearEditImages()
            setIsEditProductSheetOpen(false)
            await loadProducts(1)
        } finally {
            setIsEditSubmitting(false)
        }
    }

    const handleDeleteProduct = async (product: Product) => {
        setDeleteConfirmData({
            productId: product._id,
            productName: product.name,
            hasActiveSales: false,
            salesCount: 0,
            isInBatch: false,
            batchName: null,
        })
        setShowDeleteConfirm(true)
        setIsDeleteInfoLoading(true)

        try {
            const response = await fetch(`/api/products/${product._id}`, {
                method: "DELETE",
            })

            const data = await response.json()
            if (!response.ok) {
                alert("Failed to get deletion info")
                return
            }

            setDeleteConfirmData((current) => {
                if (!current || current.productId !== product._id) {
                    return current
                }

                return {
                    ...current,
                    hasActiveSales: data.deletionInfo.hasActiveSales,
                    salesCount: data.deletionInfo.salesCount,
                    isInBatch: data.deletionInfo.isInBatch,
                    batchName: data.deletionInfo.batchName,
                }
            })
        } catch (error) {
            alert("Failed to get deletion info")
            console.error(error)
        } finally {
            setIsDeleteInfoLoading(false)
        }
    }

    const confirmDeleteProduct = async () => {
        if (!deleteConfirmData || isDeleteInfoLoading) return

        setIsDeleting(true)
        try {
            const response = await fetch(`/api/products/${deleteConfirmData.productId}?confirm=true`, {
                method: "DELETE",
            })

            if (!response.ok) {
                alert("Failed to delete product")
                return
            }

            toast.success("Product deleted")

            setShowDeleteConfirm(false)
            setDeleteConfirmData(null)
            setIsDeleteInfoLoading(false)
            await loadProducts(1)
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

    // Server already sorts all columns except derived profit.
    const sortedFilteredProducts = React.useMemo(() => {
        if (sortColumn !== "profit") {
            return products
        }

        const sorted = [...products]

        sorted.sort((a, b) => {
            const aValue = typeof a.intendedSellingPrice === "number" ? a.intendedSellingPrice - a.landedCost : Number.NEGATIVE_INFINITY
            const bValue = typeof b.intendedSellingPrice === "number" ? b.intendedSellingPrice - b.landedCost : Number.NEGATIVE_INFINITY

            if (aValue < bValue) return sortDirection === "asc" ? -1 : 1
            if (aValue > bValue) return sortDirection === "asc" ? 1 : -1
            return 0
        })

        return sorted
    }, [products, sortColumn, sortDirection])

    const paginatedProducts = sortedFilteredProducts
    const selectedProducts = products.filter((product) => selectedProductIds.has(product._id))
    const singleSelectedProduct = selectedProducts.length === 1 ? selectedProducts[0] : null
    const intendedSellingPricesByProductId = React.useMemo(() => getAllIntendedSellingPrices(products), [products])
    const currentEditProduct = React.useMemo(() => {
        return products.find((p) => p._id === editProductId)
    }, [products, editProductId])

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

    const handleColumnVisibilityChange = React.useCallback((column: ProductTableColumnKey, isVisible: boolean) => {
        setVisibleColumns((current) => ({
            ...current,
            [column]: isVisible,
        }))
    }, [])

    const orderedVisibleColumns = React.useMemo(
        () => columnOrder.filter((columnKey) => visibleColumns[columnKey]),
        [columnOrder, visibleColumns]
    )
    const productsTableColumnCount = orderedVisibleColumns.length + 2

    const columnLabels: Record<ProductTableColumnKey, string> = {
        image: "Image",
        name: "Name",
        batch: "Batch",
        added: "Added",
        onHand: "On Hand",
        buyingPrice: "Purchase",
        sellingPrice: "Selling Price",
        landedPrice: "Landed Costs",
        profit: "Profit",
    }

    const handleColumnDrop = React.useCallback((targetColumn: ProductTableColumnKey) => {
        if (!draggedColumn || draggedColumn === targetColumn) {
            return
        }

        setColumnOrder((current) => {
            const next = [...current]
            const fromIndex = next.indexOf(draggedColumn)
            const toIndex = next.indexOf(targetColumn)

            if (fromIndex === -1 || toIndex === -1) {
                return current
            }

            next.splice(fromIndex, 1)
            next.splice(toIndex, 0, draggedColumn)
            return next
        })

        setDraggedColumn(null)
    }, [draggedColumn])

    const handleSortColumnClick = React.useCallback((columnKey: ProductTableColumnKey) => {
        if (columnKey === "image") {
            return
        }

        setSortColumn((currentColumn) => {
            if (currentColumn === columnKey) {
                setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"))
                return currentColumn
            }

            setSortDirection("asc")
            return columnKey
        })
    }, [])

    const renderProductColumnCell = React.useCallback((product: Product, columnKey: ProductTableColumnKey) => {
        const intendedSellingPrice = intendedSellingPricesByProductId[product._id]
        const intendedProfitPerUnit = typeof intendedSellingPrice === "number"
            ? intendedSellingPrice - product.landedCost
            : undefined
        const renderUnitAllValue = (unitValue: number, totalValue: number) => {
            if (product.quantityInitial === 1) {
                return <div className="font-medium">{Math.floor(unitValue).toLocaleString()}</div>
            }

            return (
                <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">Unit: {Math.floor(unitValue).toLocaleString()}</div>
                    <div className="font-medium">All: {Math.floor(totalValue).toLocaleString()}</div>
                </div>
            )
        }

        if (columnKey === "image") {
            return (
                <TableCell className="p-0">
                    <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50" onClick={(event) => event.stopPropagation()}>
                        {product.images?.[0] ? (
                            <img
                                src={product.images[0]}
                                alt={product.name}
                                className="h-10 w-10 rounded-md object-cover"
                                loading="lazy"
                            />
                        ) : (
                            <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {product.name.replace(/\s+/g, "").slice(0, 2).toUpperCase()}
                            </div>
                        )}
                    </Link>
                </TableCell>
            )
        }

        if (columnKey === "name") {
            return (
                <TableCell className="p-0 max-w-xs">
                    <Link href={`/app/products/${product._id}`} className="block p-2 cursor-pointer hover:bg-muted/50" onClick={(event) => event.stopPropagation()}>
                        <span className="block w-11/12 overflow-hidden text-ellipsis whitespace-nowrap" title={product.name}>
                            {product.name}
                        </span>
                    </Link>
                </TableCell>
            )
        }

        if (columnKey === "batch") {
            return (
                <TableCell className="p-0">
                    <div className="block p-2">{product.batchId?.batchName ?? "Unassigned"}</div>
                </TableCell>
            )
        }

        if (columnKey === "added") {
            return (
                <TableCell className="p-0">
                    <div className="block p-2">
                        {new Date(product.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                        })}
                    </div>
                </TableCell>
            )
        }

        if (columnKey === "onHand") {
            return (
                <TableCell className="p-0">
                    <div className="block p-2 font-medium">{product.quantityRemaining.toLocaleString()}</div>
                </TableCell>
            )
        }

        if (columnKey === "buyingPrice") {
            return (
                <TableCell className="p-0">
                    <div className="block p-2">
                        {renderUnitAllValue(product.purchasePriceRWF, product.purchasePriceRWF * product.quantityInitial)}
                    </div>
                </TableCell>
            )
        }

        if (columnKey === "sellingPrice") {
            return (
                <TableCell className="p-0">
                    <div className="block p-2">
                        {typeof intendedSellingPrice === "number"
                            ? renderUnitAllValue(intendedSellingPrice, intendedSellingPrice * product.quantityInitial)
                            : "-"}
                    </div>
                </TableCell>
            )
        }

        if (columnKey === "landedPrice") {
            return (
                <TableCell className="p-0">
                    <div className="block p-2">
                        {renderUnitAllValue(product.landedCost, product.landedCost * product.quantityInitial)}
                    </div>
                </TableCell>
            )
        }

        if (columnKey === "profit") {
            return (
                <TableCell className="p-0">
                    <div className={cn("block p-2", typeof intendedProfitPerUnit === "number" && intendedProfitPerUnit < 0 ? "text-destructive" : "")}>
                        {typeof intendedProfitPerUnit === "number"
                            ? renderUnitAllValue(intendedProfitPerUnit, intendedProfitPerUnit * product.quantityInitial)
                            : "-"}
                    </div>
                </TableCell>
            )
        }

        return null
    }, [intendedSellingPricesByProductId])

    const handleDeleteSelectedProduct = React.useCallback(() => {
        if (selectedProducts.length === 0) {
            return
        }

        if (selectedProducts.length === 1) {
            void handleDeleteProduct(selectedProducts[0])
            return
        }

        setBulkDeleteError("")
        setShowBulkDeleteConfirm(true)
        setIsBulkDeleteInfoLoading(true)
        setBulkDeleteWarningSummary({
            productsWithSales: 0,
            productsInBatches: 0,
            totalSalesRecords: 0,
        })

        void (async () => {
            try {
                const responses = await Promise.all(
                    selectedProducts.map((product) =>
                        fetch(`/api/products/${product._id}`, {
                            method: "DELETE",
                        })
                    )
                )

                let productsWithSales = 0
                let productsInBatches = 0
                let totalSalesRecords = 0

                for (const response of responses) {
                    const data = await response.json().catch(() => null)
                    if (!response.ok || !data?.deletionInfo) {
                        continue
                    }

                    if (data.deletionInfo.hasActiveSales) {
                        productsWithSales += 1
                    }
                    if (data.deletionInfo.isInBatch) {
                        productsInBatches += 1
                    }
                    totalSalesRecords += Number(data.deletionInfo.salesCount ?? 0)
                }

                setBulkDeleteWarningSummary({
                    productsWithSales,
                    productsInBatches,
                    totalSalesRecords,
                })
            } catch {
                setBulkDeleteError("Failed to load bulk delete warnings")
            } finally {
                setIsBulkDeleteInfoLoading(false)
            }
        })()
    }, [handleDeleteProduct, selectedProducts])

    const confirmBulkDeleteProducts = React.useCallback(async () => {
        if (selectedProducts.length === 0 || isBulkDeleteInfoLoading) {
            return
        }

        setIsBulkDeleting(true)
        setBulkDeleteError("")

        try {
            const failedProducts: string[] = []

            for (const product of selectedProducts) {
                const response = await fetch(`/api/products/${product._id}?confirm=true`, {
                    method: "DELETE",
                })

                if (!response.ok) {
                    failedProducts.push(product.name)
                }
            }

            if (failedProducts.length > 0) {
                setBulkDeleteError(`Failed to delete: ${failedProducts.join(", ")}`)
                return
            }

            setShowBulkDeleteConfirm(false)
            setSelectedProductIds(new Set())
            await loadProducts(1)
        } finally {
            setIsBulkDeleting(false)
        }
    }, [isBulkDeleteInfoLoading, loadProducts, selectedProducts])

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
            <Button
                variant="outline"
                size="sm"
                onClick={() => openEditProductSheet(product)}
            >
                Edit
            </Button>

            <Button
                variant="outline"
                size="sm"
                onClick={() => openSaleModalForProduct(product)}
            >
                Sell
            </Button>
        </div>
    )

    const applyProductSearch = React.useCallback((rawValue: string) => {
        const nextSearch = rawValue.trim()
        setProductSearch(nextSearch)
        void loadProducts(1, nextSearch)
    }, [loadProducts])

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
            <CardHeader className="flex items-center justify-between gap-3">
                <div>
                    <CardTitle className="text-2xl font-bold">Products</CardTitle>
                    <CardDescription>Manage products, stock, and batch assignment</CardDescription>
                </div>
                <div className="flex items-center max-md:flex-col gap-2">
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
                    <AddProductSheet
                        open={isAddProductSheetOpen}
                        onOpenChange={handleAddProductSheetOpenChange}
                        onProductCreated={loadProducts}
                        triggerButton={<Button size={"lg"} className="h-10 px-6">Add Product</Button>}
                    />
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="overflow-hidden rounded-xl border">
                        <div className="min-w-245 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Image</TableHead>
                                        <TableHead>Name</TableHead>
                                        <TableHead>On Hand</TableHead>
                                        <TableHead>Purchase</TableHead>
                                        <TableHead>Landed Costs</TableHead>
                                        <TableHead>Selling Price</TableHead>
                                        <TableHead>Profit</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Array.from({ length: 6 }).map((_, index) => (
                                        <TableRow key={`products-loading-${index}`}>
                                            <TableCell><Skeleton className="h-10 w-10 rounded-md" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-8 w-28 rounded-md" /></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : viewMode === "list" ? (
                    <>
                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-96">
                                <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    ref={productSearchInputRef}
                                    value={productSearchInput}
                                    onChange={(event) => setProductSearchInput(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault()
                                            applyProductSearch(productSearchInput)
                                        }
                                    }}
                                    placeholder="Search products"
                                    className="h-12 pr-18 pl-9"
                                />
                                {productSearchInput ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setProductSearchInput("")
                                            applyProductSearch("")
                                        }}
                                        className="absolute right-1 top-1 bottom-1 flex w-10 items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700"
                                    >
                                        <XIcon className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <KbdGroup className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:flex">
                                        <Kbd>Ctrl</Kbd>
                                        <Kbd>F</Kbd>
                                    </KbdGroup>
                                )}
                            </div>
                            <div className="flex w-full items-center gap-2 sm:w-auto">
                                <h3 className="text-sm text-muted-foreground">Total</h3>
                                <p className="text-sm font-semibold">{products.length}</p>
                                {selectedProductIds.size > 0 && (
                                    <>
                                        <span className="text-xs text-muted-foreground">|</span>
                                        <p className="text-sm font-medium text-primary">{selectedProductIds.size} selected</p>
                                    </>
                                )}
                            </div>
                            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end sm:ml-auto">
                                {(filterPriceMin || filterPriceMax || filterCategories.size > 0 || filterBatches.size > 0) && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-12 px-4"
                                        onClick={() => {
                                            setFilterPriceMin("")
                                            setFilterPriceMax("")
                                            setFilterCategories(new Set())
                                            setFilterBatches(new Set())
                                        }}
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                                <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
                                    <SheetTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-12 px-4">
                                            Filter
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto" overlayClassName="" overlayStyle={{ backgroundColor: "transparent" }}>
                                        <SheetHeader>
                                            <SheetTitle>Filter Products</SheetTitle>
                                            <SheetDescription>Apply filters to narrow down your product list</SheetDescription>
                                        </SheetHeader>
                                        <div className="space-y-6 py-6 px-6">
                                            {/* Landed Cost Range Filter */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Landed Cost Range (RWF)</label>
                                                <div className="flex gap-2 mt-2 items-center">
                                                    <div className="flex-1">
                                                        <Input
                                                            type="text"
                                                            placeholder="Min"
                                                            value={filterPriceMin}
                                                            onChange={(e) => setFilterPriceMin(toDecimalInput(e.target.value))}
                                                        />
                                                    </div> -
                                                    <div className="flex-1">
                                                        <Input
                                                            type="text"
                                                            placeholder="Max"
                                                            value={filterPriceMax}
                                                            onChange={(e) => setFilterPriceMax(toDecimalInput(e.target.value))}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Category Filter */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Categories</label>
                                                <div className="space-y-2 max-h-48 mt-2 overflow-y-auto border rounded-md p-3">
                                                    {categories.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">No categories available</p>
                                                    ) : (
                                                        categories.map((category) => (
                                                            <div key={category._id} className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id={`category-${category._id}`}
                                                                    checked={filterCategories.has(category._id)}
                                                                    onCheckedChange={(checked) => {
                                                                        setFilterCategories((prev) => {
                                                                            const next = new Set(prev)
                                                                            if (checked) {
                                                                                next.add(category._id)
                                                                            } else {
                                                                                next.delete(category._id)
                                                                            }
                                                                            return next
                                                                        })
                                                                    }}
                                                                />
                                                                <label htmlFor={`category-${category._id}`} className="text-sm cursor-pointer">{category.name}</label>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>

                                            {/* Batch Filter */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Batches</label>
                                                <div className="space-y-2 max-h-48 mt-2 overflow-y-auto border rounded-md p-3">
                                                    {batches.length === 0 ? (
                                                        <p className="text-sm text-muted-foreground">No batches available</p>
                                                    ) : (
                                                        batches.map((batch) => (
                                                            <div key={batch._id} className="flex items-center gap-2">
                                                                <Checkbox
                                                                    id={`batch-${batch._id}`}
                                                                    checked={filterBatches.has(batch._id)}
                                                                    onCheckedChange={(checked) => {
                                                                        setFilterBatches((prev) => {
                                                                            const next = new Set(prev)
                                                                            if (checked) {
                                                                                next.add(batch._id)
                                                                            } else {
                                                                                next.delete(batch._id)
                                                                            }
                                                                            return next
                                                                        })
                                                                    }}
                                                                />
                                                                <label htmlFor={`batch-${batch._id}`} className="text-sm cursor-pointer">{batch.batchName}</label>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 border-t pt-6 px-6">
                                            <Button
                                                variant="outline"
                                                className="flex-1"
                                                onClick={() => {
                                                    setFilterPriceMin("")
                                                    setFilterPriceMax("")
                                                    setFilterCategories(new Set())
                                                    setFilterBatches(new Set())
                                                    setProductSearch("")
                                                    setProductSearchInput("")
                                                }}
                                            >
                                                Clear All
                                            </Button>
                                            <Button
                                                className="flex-1"
                                                onClick={applyFilters}
                                            >
                                                Apply Filters
                                            </Button>
                                        </div>
                                    </SheetContent>
                                </Sheet>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button size="sm" variant="outline" className="h-12 px-4">
                                            <Columns3Icon className="h-4 w-4" />
                                            Columns
                                            <ChevronDownIcon className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56">
                                        <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuCheckboxItem checked={visibleColumns.image} onCheckedChange={(value) => handleColumnVisibilityChange("image", Boolean(value))}>Image</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.name} onCheckedChange={(value) => handleColumnVisibilityChange("name", Boolean(value))}>Name</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.batch} onCheckedChange={(value) => handleColumnVisibilityChange("batch", Boolean(value))}>Batch</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.added} onCheckedChange={(value) => handleColumnVisibilityChange("added", Boolean(value))}>Added</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.onHand} onCheckedChange={(value) => handleColumnVisibilityChange("onHand", Boolean(value))}>On Hand</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.buyingPrice} onCheckedChange={(value) => handleColumnVisibilityChange("buyingPrice", Boolean(value))}>Purchase</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.sellingPrice} onCheckedChange={(value) => handleColumnVisibilityChange("sellingPrice", Boolean(value))}>Selling Price</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.landedPrice} onCheckedChange={(value) => handleColumnVisibilityChange("landedPrice", Boolean(value))}>Landed Costs</DropdownMenuCheckboxItem>
                                        <DropdownMenuCheckboxItem checked={visibleColumns.profit} onCheckedChange={(value) => handleColumnVisibilityChange("profit", Boolean(value))}>Profit</DropdownMenuCheckboxItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {selectedProductIds.size > 0 ? (
                                    <>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-12 px-4"
                                            disabled={selectedProducts.filter((product) => product.quantityRemaining > 0).length === 0}
                                            onClick={() => {
                                                if (selectedProducts.length === 0) {
                                                    return
                                                }
                                                openBulkSaleModalForProducts(selectedProducts)
                                            }}
                                        >
                                            <ShoppingCartIcon className="h-4 w-4" />
                                            Sell Selected
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-12 px-4"
                                            disabled={selectedProducts.length === 0}
                                            onClick={handleDeleteSelectedProduct}
                                        >
                                            <Trash2Icon className="h-4 w-4" />
                                            Delete Selected
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-12 px-4" onClick={() => setSelectedProductIds(new Set())}>Clear Selection</Button>
                                    </>
                                ) : null}
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-xl border">
                            <div className="min-w-245 overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox
                                                    checked={paginatedProducts.length > 0 && paginatedProducts.every((product) => selectedProductIds.has(product._id))}
                                                    onCheckedChange={(value) => {
                                                        if (value) {
                                                            setSelectedProductIds((prev) => {
                                                                const next = new Set(prev)
                                                                paginatedProducts.forEach((product) => next.add(product._id))
                                                                return next
                                                            })
                                                        } else {
                                                            setSelectedProductIds((prev) => {
                                                                const next = new Set(prev)
                                                                paginatedProducts.forEach((product) => next.delete(product._id))
                                                                return next
                                                            })
                                                        }
                                                    }}
                                                    title="Select all on this page"
                                                />
                                            </TableHead>
                                            {orderedVisibleColumns.map((columnKey) => (
                                                <TableHead
                                                    key={columnKey}
                                                    draggable
                                                    onDragStart={() => setDraggedColumn(columnKey)}
                                                    onDragEnd={() => setDraggedColumn(null)}
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDrop={() => handleColumnDrop(columnKey)}
                                                    className="cursor-move select-none"
                                                    title="Drag to reorder columns"
                                                >
                                                    <button
                                                        type="button"
                                                        className="flex items-center gap-1"
                                                        onClick={() => handleSortColumnClick(columnKey)}
                                                    >
                                                        {columnLabels[columnKey]}
                                                        {columnKey !== "image" && sortColumn === columnKey ? (
                                                            sortDirection === "asc" ? (
                                                                <ChevronUpIcon className="h-4 w-4" />
                                                            ) : (
                                                                <ChevronDownIcon className="h-4 w-4" />
                                                            )
                                                        ) : null}
                                                    </button>
                                                </TableHead>
                                            ))}
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedFilteredProducts.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={productsTableColumnCount} className="py-8 text-center text-muted-foreground">
                                                    No results found.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            paginatedProducts.map((product) => (
                                                <TableRow
                                                    key={product._id}
                                                    className={selectedProductIds.has(product._id) ? "bg-primary/20 text-foreground hover:bg-primary/20 cursor-default" : "hover:bg-muted/40 cursor-default"}
                                                    onClick={() => {
                                                        setSelectedProductIds((current) => {
                                                            const next = new Set(current)
                                                            if (next.has(product._id)) {
                                                                next.delete(product._id)
                                                            } else {
                                                                next.add(product._id)
                                                            }
                                                            return next
                                                        })
                                                    }}
                                                >
                                                    <TableCell onClick={(e) => e.stopPropagation()} className="p-3">
                                                        <Checkbox
                                                            checked={selectedProductIds.has(product._id)}
                                                            onCheckedChange={(value) => {
                                                                const newSelected = new Set(selectedProductIds)
                                                                if (value) {
                                                                    newSelected.add(product._id)
                                                                } else {
                                                                    newSelected.delete(product._id)
                                                                }
                                                                setSelectedProductIds(newSelected)
                                                            }}
                                                        />
                                                    </TableCell>
                                                    {orderedVisibleColumns.map((columnKey) => (
                                                        <React.Fragment key={`${product._id}-${columnKey}`}>
                                                            {renderProductColumnCell(product, columnKey)}
                                                        </React.Fragment>
                                                    ))}
                                                    <TableCell onClick={(event) => event.stopPropagation()}>{renderProductActions(product)}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        {totalCount > 0 && (
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} products
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadProducts(Math.max(currentPage - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeftIcon className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={currentPage === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => loadProducts(pageNum)}
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadProducts(Math.min(currentPage + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                            {paginatedProducts.map((product) => (
                                (() => {
                                    const intendedSellingPrice = intendedSellingPricesByProductId[product._id]
                                    const intendedProfitPerUnit = typeof intendedSellingPrice === "number"
                                        ? intendedSellingPrice - product.landedCost
                                        : undefined

                                    return (
                                        <div
                                            key={product._id}
                                            className="cursor-pointer rounded-lg border bg-card p-4"
                                            role="link"
                                            tabIndex={0}
                                            onClick={() => router.push(`/app/products/${product._id}`)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter" || event.key === " ") {
                                                    event.preventDefault()
                                                    router.push(`/app/products/${product._id}`)
                                                }
                                            }}
                                        >
                                            <Link href={`/app/products/${product._id}`} className="block mb-3 overflow-hidden rounded-md border bg-muted">
                                                {product.images?.[0] ? (
                                                    <img
                                                        src={product.images[0]}
                                                        alt={product.name}
                                                        className="h-36 w-full object-cover"
                                                        loading="lazy"
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
                                                <Badge variant="secondary" className="text-white">Buying Price: RWF {product.purchasePriceRWF.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Badge>
                                            </div>
                                            <div className="mt-3 text-xs text-muted-foreground">
                                                Landed Costs (RWF): {product.landedCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Selling Price (RWF): {typeof intendedSellingPrice === "number"
                                                    ? intendedSellingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                    : "-"}
                                            </div>
                                            <div className={cn("mt-1 text-xs", typeof intendedProfitPerUnit === "number" && intendedProfitPerUnit >= 0 ? "text-emerald-600" : "text-destructive")}>
                                                Intended Profit / Unit (RWF): {typeof intendedProfitPerUnit === "number"
                                                    ? intendedProfitPerUnit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                                    : "-"}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Landed Total (RWF): {(product.landedCost * product.quantityRemaining).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="mt-4" onClick={(event) => event.stopPropagation()}>{renderProductActions(product)}</div>
                                        </div>
                                    )
                                })()
                            ))}
                        </div>

                        {/* Grid View Pagination Controls */}
                        {totalCount > 0 && (
                            <div className="mt-6 flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">
                                    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} products
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadProducts(Math.max(currentPage - 1, 1))}
                                        disabled={currentPage === 1}
                                    >
                                        <ChevronLeftIcon className="h-4 w-4" />
                                        Previous
                                    </Button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                                            let pageNum;
                                            if (totalPages <= 5) {
                                                pageNum = i + 1;
                                            } else if (currentPage <= 3) {
                                                pageNum = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                pageNum = totalPages - 4 + i;
                                            } else {
                                                pageNum = currentPage - 2 + i;
                                            }
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={currentPage === pageNum ? "default" : "outline"}
                                                    size="sm"
                                                    onClick={() => loadProducts(pageNum)}
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => loadProducts(Math.min(currentPage + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                    >
                                        Next
                                        <ChevronRightIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
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
                        <form className="p-6" onSubmit={submitSaleFromModal} onKeyDown={preventImplicitSubmitOnEnter}>
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
                                    <div className="relative mb-4">
                                        <Input
                                            placeholder="Search products..."
                                            value={saleProductSearch}
                                            onChange={(event) => setSaleProductSearch(event.target.value)}
                                            className="h-12 pr-14"
                                        />
                                        {saleProductSearch ? (
                                            <button
                                                type="button"
                                                onClick={() => setSaleProductSearch("")}
                                                className="absolute right-1 top-1 bottom-1 flex w-10 items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 hover:text-red-700"
                                                aria-label="Clear search"
                                            >
                                                <XIcon className="h-4 w-4" />
                                            </button>
                                        ) : null}
                                    </div>

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
                            ) : saleStep === "details" ? (
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
                                                        Profit: <span className="font-bold">{saleProfitPerUnit.toLocaleString()} RWF</span> per unit
                                                    </p>
                                                ) : saleProfitPerUnit < 0 ? (
                                                    <p className="text-sm font-medium text-destructive">
                                                        Loss: <span className="font-bold">{Math.abs(saleProfitPerUnit).toLocaleString()} RWF</span> per unit
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
                                                Landed Total: <span className="font-semibold text-foreground">{saleTotalLandedCost.toLocaleString()} RWF</span>
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
                            ) : (
                                <>
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold text-foreground">Record Bulk Sale</h2>
                                        <p className="text-sm text-muted-foreground">
                                            Set quantity and selling price for each selected product.
                                        </p>
                                    </div>

                                    <div className="space-y-4 mb-6 max-h-[55vh] overflow-y-auto pr-1">
                                        {bulkSaleRows.map((row) => {
                                            const quantityValue = Number(row.quantity || 0)
                                            const sellingPriceValue = Number(stripCommas(row.sellingPrice) || 0)
                                            const totalLandedCost = row.landedCost * quantityValue
                                            const totalSellingValue = sellingPriceValue * quantityValue
                                            const totalProfit = totalSellingValue - totalLandedCost

                                            return (
                                                <div key={row.productId} className="rounded-lg border border-border p-3">
                                                    <div className="mb-3">
                                                        <p className="font-medium text-foreground truncate">{row.name}</p>
                                                        <p className="text-xs text-muted-foreground">Available: {row.availableQuantity}</p>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div>
                                                            <label className="text-sm font-medium text-foreground block mb-2">Quantity</label>
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                placeholder="Enter quantity"
                                                                value={row.quantity}
                                                                onChange={(event) => {
                                                                    const nextQuantity = toIntegerInput(event.target.value)
                                                                    setBulkSaleRows((current) =>
                                                                        current.map((currentRow) =>
                                                                            currentRow.productId === row.productId
                                                                                ? { ...currentRow, quantity: nextQuantity }
                                                                                : currentRow
                                                                        )
                                                                    )
                                                                }}
                                                            />
                                                            {bulkSaleRowErrors[row.productId]?.quantity ? (
                                                                <FieldError className="text-destructive text-xs mt-2">
                                                                    {bulkSaleRowErrors[row.productId]?.quantity}
                                                                </FieldError>
                                                            ) : null}
                                                        </div>

                                                        <div>
                                                            <label className="text-sm font-medium text-foreground block mb-2">Selling Price / Unit</label>
                                                            <Input
                                                                type="text"
                                                                inputMode="decimal"
                                                                placeholder="Enter selling price"
                                                                value={row.sellingPrice}
                                                                onChange={(event) => {
                                                                    const nextSellingPrice = toDecimalInput(event.target.value)
                                                                    setBulkSaleRows((current) =>
                                                                        current.map((currentRow) =>
                                                                            currentRow.productId === row.productId
                                                                                ? { ...currentRow, sellingPrice: nextSellingPrice }
                                                                                : currentRow
                                                                        )
                                                                    )
                                                                }}
                                                            />
                                                            {bulkSaleRowErrors[row.productId]?.sellingPrice ? (
                                                                <FieldError className="text-destructive text-xs mt-2">
                                                                    {bulkSaleRowErrors[row.productId]?.sellingPrice}
                                                                </FieldError>
                                                            ) : null}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                                                        <p>
                                                            Landed Total: <span className="font-semibold text-foreground">{totalLandedCost.toLocaleString()} RWF</span>
                                                        </p>
                                                        <p>
                                                            Selling Total: <span className="font-semibold text-foreground">{totalSellingValue.toLocaleString()} RWF</span>
                                                        </p>
                                                        <p>
                                                            {totalProfit >= 0 ? "Profit" : "Loss"}: <span className={totalProfit >= 0 ? "font-bold text-primary" : "font-bold text-destructive"}>{Math.abs(totalProfit).toLocaleString()} RWF</span>
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}

                                        {bulkSaleGeneralError ? <FieldError className="text-destructive text-xs">{bulkSaleGeneralError}</FieldError> : null}
                                    </div>

                                    <div className="flex gap-3">
                                        <Button type="button" variant="outline" onClick={requestCloseSaleModal}>
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            loading={isSaleSubmitting}
                                            loadingText="Recording sales"
                                            className="flex-1"
                                        >
                                            Record Sales
                                        </Button>
                                    </div>
                                </>
                            )}
                        </form>
                    </div>
                </div>
            )}

            {showBulkDeleteConfirm ? (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 animate-in fade-in duration-150">
                    <div className="modal-pop-in w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-950">
                        <h3 className="text-lg font-semibold text-destructive">Delete Selected Products?</h3>
                        <p className="mt-3 text-sm text-muted-foreground">
                            You are about to permanently delete <span className="font-semibold text-foreground">{selectedProducts.length}</span> products.
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">This action cannot be undone.</p>

                        {isBulkDeleteInfoLoading ? (
                            <div className="mt-4 space-y-2">
                                <Skeleton className="h-3 w-3/4" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ) : (bulkDeleteWarningSummary.productsWithSales > 0 || bulkDeleteWarningSummary.productsInBatches > 0) ? (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">Warning</p>
                                <ul className="list-disc pl-5 text-sm space-y-1 text-amber-800 dark:text-amber-300">
                                    {bulkDeleteWarningSummary.productsWithSales > 0 ? (
                                        <li>
                                            <span className="font-semibold">{bulkDeleteWarningSummary.productsWithSales}</span>
                                            {" "}
                                            selected product{bulkDeleteWarningSummary.productsWithSales === 1 ? "" : "s"}
                                            {" "}
                                            {bulkDeleteWarningSummary.productsWithSales === 1 ? "has" : "have"}
                                            {" "}
                                            a total of
                                            {" "}
                                            <span className="font-semibold">{bulkDeleteWarningSummary.totalSalesRecords}</span>
                                            {" "}
                                            sale record{bulkDeleteWarningSummary.totalSalesRecords === 1 ? "" : "s"}.
                                        </li>
                                    ) : null}
                                    {bulkDeleteWarningSummary.productsInBatches > 0 ? (
                                        <li>
                                            <span className="font-semibold">{bulkDeleteWarningSummary.productsInBatches}</span>
                                            {" "}
                                            selected product{bulkDeleteWarningSummary.productsInBatches === 1 ? "" : "s"}
                                            {" "}
                                            {bulkDeleteWarningSummary.productsInBatches === 1 ? "belongs" : "belong"}
                                            {" "}
                                            to batch{bulkDeleteWarningSummary.productsInBatches === 1 ? "" : "es"}.
                                        </li>
                                    ) : null}
                                </ul>
                            </div>
                        ) : null}

                        {bulkDeleteError ? (
                            <FieldError className="mt-3 text-destructive text-xs">{bulkDeleteError}</FieldError>
                        ) : null}

                        <div className="mt-6 flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    if (isBulkDeleting) {
                                        return
                                    }
                                    setShowBulkDeleteConfirm(false)
                                    setIsBulkDeleteInfoLoading(false)
                                    setBulkDeleteWarningSummary({
                                        productsWithSales: 0,
                                        productsInBatches: 0,
                                        totalSalesRecords: 0,
                                    })
                                }}
                                disabled={isBulkDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={() => {
                                    void confirmBulkDeleteProducts()
                                }}
                                disabled={isBulkDeleting || isBulkDeleteInfoLoading}
                                loading={isBulkDeleting || isBulkDeleteInfoLoading}
                                loadingText={isBulkDeleteInfoLoading ? "Checking warnings" : "Deleting products"}
                            >
                                Delete Selected
                            </Button>
                        </div>
                    </div>
                </div>
            ) : null}

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

                        {isDeleteInfoLoading ? (
                            <div className="mt-4 space-y-2">
                                <Skeleton className="h-3 w-3/4" />
                                <Skeleton className="h-3 w-2/3" />
                            </div>
                        ) : (deleteConfirmData.hasActiveSales || deleteConfirmData.isInBatch) ? (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                                <p className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">Warning</p>
                                <ul className="list-disc pl-5 text-sm space-y-1 text-amber-800 dark:text-amber-300">
                                    {deleteConfirmData.hasActiveSales && (
                                        <li>
                                            This product has
                                            {" "}
                                            <span className="font-semibold">{deleteConfirmData.salesCount}</span>
                                            {" "}
                                            sale{deleteConfirmData.salesCount === 1 ? "" : "s"} recorded.
                                        </li>
                                    )}
                                    {deleteConfirmData.isInBatch && (
                                        <li>This product is assigned to batch <span className="font-semibold">{deleteConfirmData.batchName}</span>.</li>
                                    )}
                                </ul>
                            </div>
                        ) : null}

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
                                    setIsDeleteInfoLoading(false)
                                }}
                                disabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={confirmDeleteProduct}
                                disabled={isDeleting || isDeleteInfoLoading}
                                loading={isDeleting || isDeleteInfoLoading}
                                loadingText={isDeleteInfoLoading ? "Checking warnings" : "Deleting product"}
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
                        loading="lazy"
                        onClick={(event) => event.stopPropagation()}
                    />
                </div>
            ) : null}

            {/* Edit Product Sheet - Rendered Once at Component Level */}
            {editProductId && (
                <Sheet
                    open={isEditProductSheetOpen}
                    onOpenChange={handleEditProductSheetOpenChange}
                >
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
                            <SheetTitle className="truncate">Edit {currentEditProduct?.name || "Product"}</SheetTitle>
                            <SheetDescription>
                                Update product details and batch assignment.
                            </SheetDescription>
                        </SheetHeader>
                        <form className="grid gap-6 p-4" onSubmit={submitEditProduct} onKeyDown={preventImplicitSubmitOnEnter}>
                            {/* Images Section */}
                            <div className="space-y-3 border-b pb-4">
                                <h3 className="font-semibold text-sm">Images</h3>

                                {/* Main Image Display */}
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
                                                    const selectedFiles = toSelectedFiles(event)
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
                                                    const selectedFiles = toSelectedFiles(event)
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
                            <Button type="submit" disabled={!canSubmitEditProduct || !hasEditProductChanges || isEditSubmitting} loading={isEditSubmitting} loadingText="Saving product">
                                Save Changes
                            </Button>
                        </form>
                    </SheetContent>
                </Sheet>
            )}
        </div>
    )
}
