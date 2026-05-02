import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { buildBatchCostInputsFromBatch, calculateBatchProductLandedCosts } from "@/lib/costs"
import { uploadImageFile } from "@/lib/cloudinary"
import { BatchModel } from "@/models/Batch"
import { CategoryModel } from "@/models/Category"
import { ProductModel } from "@/models/Product"
import { SaleModel } from "@/models/Sale"
import "@/models/Category"
import "@/models/Batch"

const SUPPORTED_SOURCE_CURRENCIES = ["USD", "RWF", "CNY", "AED"]

function mapProductPersistenceError(error: unknown) {
  const errors: FieldErrors = {}

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "ValidationError" &&
    "errors" in error
  ) {
    const mongooseErrors = (error as { errors?: Record<string, { message?: string }> }).errors ?? {}
    for (const [field, fieldError] of Object.entries(mongooseErrors)) {
      errors[field] = fieldError.message ?? "Invalid value"
    }
  }

  if (Object.keys(errors).length === 0) {
    errors.general = "Failed to update product"
  }

  return errors
}

async function recalculateBatchProducts(batchId: string) {
  const batch = await BatchModel.findById(batchId).lean()
  if (!batch) {
    return
  }

  const batchProducts = await ProductModel.find({ batchId }).lean()
  const allocations = calculateBatchProductLandedCosts(
    batchProducts.map((product) => ({
      productId: String(product._id),
      quantityInitial: product.quantityInitial,
      unitPriceLocalRWF: product.unitPriceLocalRWF ?? product.purchasePriceRWF,
    })),
    buildBatchCostInputsFromBatch(batch)
  )

  const operations = allocations.map((allocation) => ({
    updateOne: {
      filter: { _id: new Types.ObjectId(allocation.productId) },
      update: {
        $set: {
          purchasePriceRWF: allocation.purchasePriceRWF,
          landedCost: allocation.landedCost,
        },
      },
    },
  }))

  if (operations.length > 0) {
    await ProductModel.bulkWrite(operations)
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const productId = (await params).id
  if (!Types.ObjectId.isValid(productId)) {
    return errorResponse({ id: "Invalid product ID" }, 400)
  }

  const [product, soldAggregation] = await Promise.all([
    ProductModel.findOne({ _id: productId, userId: user._id })
      .populate("categoryId", "name")
      .populate("batchId", "batchName")
      .lean(),
    SaleModel.aggregate<{ totalSold: number }>([
      {
        $match: {
          userId: user._id,
          productId: new Types.ObjectId(productId),
        },
      },
      {
        $group: {
          _id: null,
          totalSold: { $sum: "$quantity" },
        },
      },
    ]),
  ])

  if (!product) {
    return errorResponse({ id: "Product not found" }, 404)
  }

  const soldQuantity = soldAggregation[0]?.totalSold ?? 0
  const reconciledQuantityRemaining = Math.max(0, product.quantityInitial - soldQuantity)

  if (product.quantityRemaining !== reconciledQuantityRemaining) {
    await ProductModel.updateOne(
      { _id: productId, userId: user._id },
      { $set: { quantityRemaining: reconciledQuantityRemaining } }
    )
  }

  return successResponse({
    product: {
      ...product,
      quantityRemaining: reconciledQuantityRemaining,
      soldQuantity,
    },
  })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const productId = (await params).id
  if (!Types.ObjectId.isValid(productId)) {
    return errorResponse({ id: "Invalid product ID" }, 400)
  }

  const formData = await request.formData()

  const hasName = formData.has("name")
  const hasQuantityInitial = formData.has("quantityInitial")
  const hasUnitPriceForeign = formData.has("unitPriceForeign")
  const hasSourceCurrency = formData.has("sourceCurrency")
  const hasExchangeRate = formData.has("exchangeRate")
  const hasExternalLink = formData.has("externalLink")
  const hasCategoryId = formData.has("categoryId")
  const hasBatchId = formData.has("batchId")
  const hasIntendedSellingPrice = formData.has("intendedSellingPrice")
  const hasImagesTouched = formData.get("imagesTouched") === "1"

  const name = hasName ? String(formData.get("name") ?? "").trim() : undefined
  const rawQuantityInitial = hasQuantityInitial ? String(formData.get("quantityInitial") ?? "").trim() : undefined
  const rawUnitPriceForeign = hasUnitPriceForeign ? String(formData.get("unitPriceForeign") ?? "").trim() : undefined
  const sourceCurrency = hasSourceCurrency ? String(formData.get("sourceCurrency") ?? "").trim().toUpperCase() : undefined
  const rawExchangeRate = hasExchangeRate ? String(formData.get("exchangeRate") ?? "").trim() : undefined
  const externalLink = hasExternalLink ? String(formData.get("externalLink") ?? "").trim() : undefined
  const categoryId = hasCategoryId ? (formData.get("categoryId") ? String(formData.get("categoryId")).trim() : null) : undefined
  const batchId = hasBatchId ? (formData.get("batchId") ? String(formData.get("batchId")).trim() : null) : undefined
  const rawIntendedSellingPrice = hasIntendedSellingPrice ? String(formData.get("intendedSellingPrice") ?? "").trim() : undefined

  const quantityInitial = rawQuantityInitial !== undefined ? Number(rawQuantityInitial) : undefined
  const unitPriceForeign = rawUnitPriceForeign !== undefined ? Number(rawUnitPriceForeign) : undefined
  const intendedSellingPrice = rawIntendedSellingPrice !== undefined ? (rawIntendedSellingPrice ? Number(rawIntendedSellingPrice) : null) : undefined
  const exchangeRate = rawExchangeRate !== undefined ? Number(rawExchangeRate) : undefined
  
  // Handle multiple images
  const existingImages = formData.getAll("existingImages").map((img) => String(img))
  const newImageFiles = Array.from(formData.getAll("newImages")).filter((file) => file instanceof File) as File[]
  const imageOrder = formData.getAll("imageOrder").map((entry) => String(entry))

  const errors: FieldErrors = {}

  if (name !== undefined && !name) errors.name = "Product name is required"
  if (rawQuantityInitial !== undefined && !rawQuantityInitial) {
    errors.quantityInitial = "Quantity is required"
  } else if (quantityInitial !== undefined && (!Number.isFinite(quantityInitial) || quantityInitial < 0)) {
    errors.quantityInitial = "Quantity must be a non-negative number"
  }
  if (rawUnitPriceForeign !== undefined && !rawUnitPriceForeign) {
    errors.unitPriceForeign = "Unit price is required"
  } else if (unitPriceForeign !== undefined && (!Number.isFinite(unitPriceForeign) || unitPriceForeign < 0)) {
    errors.unitPriceForeign = "Unit price must be a non-negative number"
  }
  if (sourceCurrency !== undefined && !SUPPORTED_SOURCE_CURRENCIES.includes(sourceCurrency)) {
    errors.sourceCurrency = "Invalid currency"
  }
  const nextSourceCurrencyForValidation = sourceCurrency ?? undefined
  if (rawExchangeRate !== undefined && !rawExchangeRate && nextSourceCurrencyForValidation !== "RWF") {
    errors.exchangeRate = "Exchange rate is required"
  } else if (
    exchangeRate !== undefined &&
    nextSourceCurrencyForValidation !== "RWF" &&
    (!Number.isFinite(exchangeRate) || exchangeRate <= 0)
  ) {
    errors.exchangeRate = "Exchange rate must be a positive number"
  }
  if (externalLink !== undefined && externalLink) {
    try {
      new URL(externalLink)
    } catch {
      errors.externalLink = "Enter a valid URL"
    }
  }
  if (categoryId !== undefined && categoryId && !Types.ObjectId.isValid(categoryId)) {
    errors.categoryId = "Invalid category"
  }
  if (batchId !== undefined && batchId && !Types.ObjectId.isValid(batchId)) {
    errors.batchId = "Invalid batch"
  }
  if (rawIntendedSellingPrice !== undefined && rawIntendedSellingPrice && typeof intendedSellingPrice === "number" && (!Number.isFinite(intendedSellingPrice) || intendedSellingPrice < 0)) {
    errors.intendedSellingPrice = "Selling price must be 0 or higher"
  }
  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  try {
    // Verify product belongs to user
    const existingProduct = await ProductModel.findOne({ _id: productId, userId: user._id })
    if (!existingProduct) {
      return errorResponse({ id: "Product not found" }, 404)
    }

    if (categoryId !== undefined && categoryId) {
      const category = await CategoryModel.findOne({ _id: categoryId, userId: user._id }).lean()
      if (!category) {
        return errorResponse({ categoryId: "Category not found" }, 404)
      }
    }

    const updateData: Record<string, unknown> = {}
    const previousBatchId = existingProduct.batchId ? String(existingProduct.batchId) : null
    let nextBatchId = previousBatchId

    let soldQuantity = 0
    if (quantityInitial !== undefined) {
      const soldAggregation = await SaleModel.aggregate<{ totalSold: number }>([
        {
          $match: {
            userId: user._id,
            productId: new Types.ObjectId(productId),
          },
        },
        {
          $group: {
            _id: null,
            totalSold: { $sum: "$quantity" },
          },
        },
      ])

      soldQuantity = soldAggregation[0]?.totalSold ?? 0

      if (quantityInitial < soldQuantity) {
        return errorResponse(
          {
            quantityInitial: `Initial stock cannot be less than total sold (${soldQuantity})`,
          },
          400
        )
      }
    }

    if (name !== undefined) updateData.name = name
    if (categoryId !== undefined) updateData.categoryId = categoryId || null
    if (quantityInitial !== undefined) {
      updateData.quantityInitial = quantityInitial
      updateData.quantityRemaining = Math.max(0, quantityInitial - soldQuantity)
    }
    if (externalLink !== undefined) updateData.externalLink = externalLink
    if (intendedSellingPrice !== undefined) updateData.intendedSellingPrice = intendedSellingPrice
    if (batchId !== undefined) {
      updateData.batchId = batchId || null
      nextBatchId = batchId || null
      if (batchId) {
        // If assigned to a real batch, clear any fallback batchName stored on product
        updateData.batchName = ""
      } else {
        // If cleared batch assignment, set fallback batchName to product.createdAt formatted
        const createdAt = existingProduct.createdAt ? new Date(existingProduct.createdAt) : new Date()
        updateData.batchName = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(createdAt)
      }
    }

    const nextSourceCurrency = sourceCurrency ?? existingProduct.sourceCurrency
    const nextUnitPriceForeign = unitPriceForeign ?? existingProduct.unitPriceForeign
    const nextExchangeRateInput = exchangeRate ?? existingProduct.exchangeRate
    const resolvedExchangeRate = nextSourceCurrency === "RWF" ? 1 : nextExchangeRateInput
    const shouldRecalculateLocalPricing =
      unitPriceForeign !== undefined || sourceCurrency !== undefined || exchangeRate !== undefined

    if (unitPriceForeign !== undefined) updateData.unitPriceForeign = unitPriceForeign
    if (sourceCurrency !== undefined) updateData.sourceCurrency = sourceCurrency
    if (exchangeRate !== undefined || sourceCurrency !== undefined) {
      updateData.exchangeRate = resolvedExchangeRate
    }

    if (shouldRecalculateLocalPricing) {
      const unitPriceLocalRWF = nextUnitPriceForeign * resolvedExchangeRate
      updateData.unitPriceLocalRWF = unitPriceLocalRWF

      if (!nextBatchId) {
        updateData.purchasePriceRWF = unitPriceLocalRWF
        updateData.landedCost = unitPriceLocalRWF
      }
    }

    // Handle image updates and preserve dragged order from the client.
    if (hasImagesTouched) {
      const updatedImages: string[] = []

      if (imageOrder.length > 0) {
        let existingIndex = 0
        let newIndex = 0

        for (const token of imageOrder) {
          if (token.startsWith("existing:")) {
            const existingImage = existingImages[existingIndex]
            existingIndex += 1
            if (existingImage) {
              updatedImages.push(existingImage)
            }
            continue
          }

          if (token.startsWith("new:")) {
            const imageFile = newImageFiles[newIndex]
            newIndex += 1
            if (imageFile) {
              const uploadedImageUrl = await uploadImageFile(imageFile)
              updatedImages.push(uploadedImageUrl)
            }
          }
        }

        while (existingIndex < existingImages.length) {
          updatedImages.push(existingImages[existingIndex])
          existingIndex += 1
        }

        while (newIndex < newImageFiles.length) {
          const uploadedImageUrl = await uploadImageFile(newImageFiles[newIndex])
          updatedImages.push(uploadedImageUrl)
          newIndex += 1
        }
      } else {
        updatedImages.push(...existingImages)

        for (const imageFile of newImageFiles) {
          const uploadedImageUrl = await uploadImageFile(imageFile)
          updatedImages.push(uploadedImageUrl)
        }
      }

      updateData.images = updatedImages
    }

    const product = await ProductModel.findByIdAndUpdate(productId, updateData, { returnDocument: 'after', runValidators: true })
      .populate("categoryId", "name")
      .populate("batchId", "batchName")

    if (!product) {
      return errorResponse({ id: "Product not found" }, 404)
    }

    const movedBetweenBatches = previousBatchId !== nextBatchId
    const affectsBatchAllocation =
      movedBetweenBatches || quantityInitial !== undefined || shouldRecalculateLocalPricing

    // Only re-fetch if batch allocation was affected (to get updated landedCost)
    let hydratedProduct = product
    if (affectsBatchAllocation) {
      if (nextBatchId) {
        await recalculateBatchProducts(nextBatchId)
      }

      if (previousBatchId && previousBatchId !== nextBatchId) {
        await recalculateBatchProducts(previousBatchId)
      }

      // Re-fetch product to get updated landedCost from batch recalculation
      const refetchedProduct = await ProductModel.findById(productId)
        .populate("categoryId", "name")
        .populate("batchId", "batchName")

      if (!refetchedProduct) {
        return errorResponse({ id: "Product not found" }, 404)
      }
      
      hydratedProduct = refetchedProduct
    }

    return successResponse({ product: hydratedProduct })
  } catch (error) {
    return errorResponse(mapProductPersistenceError(error), 400)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const productId = (await params).id
  if (!Types.ObjectId.isValid(productId)) {
    return errorResponse({ id: "Invalid product ID" }, 400)
  }

  try {
    // Verify product belongs to user
    const product = await ProductModel.findOne({ _id: productId, userId: user._id }).populate("batchId", "batchName")

    if (!product) {
      return errorResponse({ id: "Product not found" }, 404)
    }

    // Check for sales
    const salesCount = await SaleModel.countDocuments({ productId, userId: user._id })
    const populatedBatch = product.batchId as { batchName?: string } | null

    // Prepare deletion data
    const deletionData = {
      productName: product.name,
      hasActiveSales: salesCount > 0,
      salesCount,
      isInBatch: Boolean(product.batchId),
      batchName: populatedBatch?.batchName ?? (product.batchName ?? null),
    }

    // Check if this is a confirmation deletion (from the delete button with ?confirm=true)
    const { searchParams } = new URL(request.url)
    const isConfirmed = searchParams.get("confirm") === "true"

    if (!isConfirmed) {
      // First call - return deletion info without deleting
      return successResponse({
        message: "Product deletion check",
        deletionInfo: deletionData,
      })
    }

    // Delete the product
    await ProductModel.findByIdAndDelete(productId)

    return successResponse({
      message: "Product deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting product:", error)
    return errorResponse({ message: "Failed to delete product" }, 500)
  }
}
