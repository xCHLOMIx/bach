"use client"

import * as React from "react"

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
import { ImagePlusIcon, LayoutGridIcon, ListIcon, PackageSearchIcon } from "lucide-react"

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
    images: string[]
    createdAt: string
}

export function ProductsPage() {
    const [products, setProducts] = React.useState<Product[]>([])
    const [categories, setCategories] = React.useState<Category[]>([])
    const [batches, setBatches] = React.useState<Batch[]>([])
    const [viewMode, setViewMode] = React.useState<"list" | "grid">("list")
    const [isAddProductSheetOpen, setIsAddProductSheetOpen] = React.useState(false)
    const [errors, setErrors] = React.useState<Record<string, string>>({})
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [productName, setProductName] = React.useState("")
    const [categoryId, setCategoryId] = React.useState("")
    const [quantityInitial, setQuantityInitial] = React.useState("0")
    const [unitPriceForeign, setUnitPriceForeign] = React.useState("0")
    const [sourceCurrency, setSourceCurrency] = React.useState("USD")
    const [exchangeRate, setExchangeRate] = React.useState("1")
    const [imageFiles, setImageFiles] = React.useState<File[]>([])
    const [imagePreviews, setImagePreviews] = React.useState<string[]>([])

    const [sellProductId, setSellProductId] = React.useState("")
    const [sellQuantity, setSellQuantity] = React.useState("1")
    const [sellPrice, setSellPrice] = React.useState("0")
    const [sellErrors, setSellErrors] = React.useState<Record<string, string>>({})

    const [assignProductId, setAssignProductId] = React.useState("")
    const [assignBatchId, setAssignBatchId] = React.useState("")
    const [assignErrors, setAssignErrors] = React.useState<Record<string, string>>({})

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
            setSourceCurrency("USD")
            setExchangeRate("1")
            setImageFiles([])
            await load()
        } finally {
            setIsSubmitting(false)
        }
    }

    const submitSale = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setSellErrors({})

        const response = await fetch("/api/sales", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: sellProductId,
                quantity: Number(sellQuantity),
                sellingPrice: Number(stripCommas(sellPrice)),
            }),
        })

        const data = await response.json()
        if (!response.ok) {
            setSellErrors(data.errors ?? { general: "Failed to sell product" })
            return
        }

        setSellQuantity("1")
        setSellPrice("0")
        setSellProductId("")
        await load()
    }

    const submitAssignBatch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        setAssignErrors({})

        const response = await fetch(`/api/batches/${assignBatchId}/products`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds: [assignProductId] }),
        })

        const data = await response.json()
        if (!response.ok) {
            setAssignErrors(data.errors ?? { general: "Failed to assign product" })
            return
        }

        setAssignBatchId("")
        setAssignProductId("")
        await load()
    }

    const renderProductActions = (product: Product) => (
        <div className="flex gap-2">
            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setAssignProductId(product._id)
                            setAssignErrors({})
                        }}
                    >
                        Assign Batch
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Assign {product.name}</SheetTitle>
                        <SheetDescription>
                            Assign product to one shipment batch.
                        </SheetDescription>
                    </SheetHeader>
                    <form className="grid gap-3 p-4" onSubmit={submitAssignBatch}>
                        <Select value={assignBatchId} onValueChange={setAssignBatchId}>
                            <SelectTrigger>
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
                        {assignErrors.batchId ? (
                            <p className="text-sm text-destructive">{assignErrors.batchId}</p>
                        ) : null}
                        {assignErrors.general ? (
                            <p className="text-sm text-destructive">{assignErrors.general}</p>
                        ) : null}
                        <Button type="submit">Save Assignment</Button>
                    </form>
                </SheetContent>
            </Sheet>

            <Sheet>
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setSellProductId(product._id)
                            setSellErrors({})
                        }}
                    >
                        Sell
                    </Button>
                </SheetTrigger>
                <SheetContent>
                    <SheetHeader>
                        <SheetTitle>Sell {product.name}</SheetTitle>
                        <SheetDescription>
                            Record a direct product sale and update stock.
                        </SheetDescription>
                    </SheetHeader>
                    <form className="grid gap-3 p-4" onSubmit={submitSale}>
                        <Input
                            type="text"
                            inputMode="numeric"
                            autoComplete="off"
                            placeholder="Quantity"
                            value={sellQuantity}
                            onChange={(event) => setSellQuantity(toIntegerInput(event.target.value))}
                        />
                        {sellErrors.quantity ? (
                            <p className="text-sm text-destructive">{sellErrors.quantity}</p>
                        ) : null}

                        <Input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="Selling price per unit"
                            value={sellPrice}
                            onChange={(event) => setSellPrice(toDecimalInput(event.target.value))}
                        />
                        {sellErrors.sellingPrice ? (
                            <p className="text-sm text-destructive">{sellErrors.sellingPrice}</p>
                        ) : null}

                        {sellErrors.general ? (
                            <p className="text-sm text-destructive">{sellErrors.general}</p>
                        ) : null}

                        <Button type="submit">Save Sale</Button>
                    </form>
                </SheetContent>
            </Sheet>
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
                {products.length === 0 ? (
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
                                    <TableRow key={product._id}>
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
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell>{product.categoryId?.name ?? "-"}</TableCell>
                                        <TableCell>{product.batchId?.batchName ?? "Unassigned"}</TableCell>
                                        <TableCell>
                                            <Badge variant={product.quantityRemaining > 0 ? "outline" : "destructive"}>
                                                {product.quantityRemaining}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{product.purchasePriceRWF.toLocaleString()}</TableCell>
                                        <TableCell>{product.landedCost.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell>{renderProductActions(product)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {products.map((product) => (
                            <div key={product._id} className="rounded-lg border bg-card p-4">
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
                                <div className="mb-1 text-base font-semibold text-card-foreground">{product.name}</div>
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
                                <div className="mt-4">{renderProductActions(product)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </div>
    )
}
