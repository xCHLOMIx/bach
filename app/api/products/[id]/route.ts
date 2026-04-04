import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { calculateBatchProductLandedCosts } from "@/lib/costs"
import { uploadImageFile } from "@/lib/cloudinary"
import { BatchModel } from "@/models/Batch"
import { ProductModel } from "@/models/Product"
import { SaleModel } from "@/models/Sale"
import "@/models/Category"
import "@/models/Batch"

const SUPPORTED_SOURCE_CURRENCIES = ["RWF", "USD", "KSH", "UGX", "AED", "EUR", "GBP"]

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
    {
      intlShipping: batch.intlShipping,
      taxValue: batch.taxValue,
      customsDuties: batch.customsDuties,
      declaration: batch.declaration,
      arrivalNotif: batch.arrivalNotif,
      warehouseStorage: batch.warehouseStorage,
      amazonPrime: batch.amazonPrime,
      warehouseUSA: batch.warehouseUSA,
      miscellaneous: batch.miscellaneous,
    }
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

  const product = await ProductModel.findOne({ _id: productId, userId: user._id })
    .populate("categoryId", "name")
    .populate("batchId", "batchName")
    .lean()

  if (!product) {
    return errorResponse({ id: "Product not found" }, 404)
  }

  return successResponse({ product })
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

  const name = formData.get("name") !== undefined ? String(formData.get("name") ?? "").trim() : undefined
  const quantityInitial = formData.get("quantityInitial") !== undefined ? Number(formData.get("quantityInitial") ?? 0) : undefined
  const unitPriceForeign = formData.get("unitPriceForeign") !== undefined ? Number(formData.get("unitPriceForeign") ?? 0) : undefined
  const sourceCurrency = formData.get("sourceCurrency") !== undefined ? String(formData.get("sourceCurrency") ?? "").trim().toUpperCase() : undefined
  const exchangeRate = formData.get("exchangeRate") !== undefined ? Number(formData.get("exchangeRate") ?? 1) : undefined
  const externalLink = formData.get("externalLink") !== undefined ? String(formData.get("externalLink") ?? "").trim() : undefined
  const batchId = formData.get("batchId") !== undefined ? (formData.get("batchId") ? String(formData.get("batchId")).trim() : null) : undefined
  
  // Handle multiple images
  const existingImages = formData.getAll("existingImages").map((img) => String(img))
  const newImageFiles = Array.from(formData.getAll("newImages")).filter((file) => file instanceof File) as File[]

  const errors: FieldErrors = {}

  if (name !== undefined && !name) errors.name = "Product name is required"
  if (quantityInitial !== undefined && (!Number.isFinite(quantityInitial) || quantityInitial < 0)) {
    errors.quantityInitial = "Quantity must be a non-negative number"
  }
  if (unitPriceForeign !== undefined && (!Number.isFinite(unitPriceForeign) || unitPriceForeign < 0)) {
    errors.unitPriceForeign = "Unit price must be a non-negative number"
  }
  if (sourceCurrency !== undefined && !SUPPORTED_SOURCE_CURRENCIES.includes(sourceCurrency)) {
    errors.sourceCurrency = "Invalid currency"
  }
  if (exchangeRate !== undefined && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
    errors.exchangeRate = "Exchange rate must be a positive number"
  }
  if (externalLink !== undefined && externalLink) {
    try {
      new URL(externalLink)
    } catch {
      errors.externalLink = "Enter a valid URL"
    }
  }
  if (batchId !== undefined && batchId && !Types.ObjectId.isValid(batchId)) {
    errors.batchId = "Invalid batch"
  }
  if (existingImages.length + newImageFiles.length > 4) {
    errors.images = "You can upload a maximum of 4 images"
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

    const updateData: Record<string, unknown> = {}
    const previousBatchId = existingProduct.batchId ? String(existingProduct.batchId) : null
    let nextBatchId = previousBatchId

    if (name !== undefined) updateData.name = name
    if (quantityInitial !== undefined) updateData.quantityInitial = quantityInitial
    if (externalLink !== undefined) updateData.externalLink = externalLink
    if (batchId !== undefined) {
      updateData.batchId = batchId || null
      nextBatchId = batchId || null
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

    // Handle image updates - support multiple images
    if (existingImages.length > 0 || newImageFiles.length > 0) {
      const updatedImages: string[] = [...existingImages]

      // Upload new image files
      for (const imageFile of newImageFiles) {
        const uploadedImageUrl = await uploadImageFile(imageFile)
        updatedImages.push(uploadedImageUrl)
      }

      updateData.images = updatedImages
    }

    const product = await ProductModel.findByIdAndUpdate(productId, updateData, { new: true, runValidators: true })
      .populate("categoryId", "name")
      .populate("batchId", "batchName")

    if (!product) {
      return errorResponse({ id: "Product not found" }, 404)
    }

    const movedBetweenBatches = previousBatchId !== nextBatchId
    const affectsBatchAllocation =
      movedBetweenBatches || quantityInitial !== undefined || shouldRecalculateLocalPricing

    if (affectsBatchAllocation) {
      if (nextBatchId) {
        await recalculateBatchProducts(nextBatchId)
      }

      if (previousBatchId && previousBatchId !== nextBatchId) {
        await recalculateBatchProducts(previousBatchId)
      }
    }

    const hydratedProduct = await ProductModel.findById(productId)
      .populate("categoryId", "name")
      .populate("batchId", "batchName")

    if (!hydratedProduct) {
      return errorResponse({ id: "Product not found" }, 404)
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
      batchName: populatedBatch?.batchName ?? null,
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
