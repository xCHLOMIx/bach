import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { uploadImageFile } from "@/lib/cloudinary"
import { ProductModel } from "@/models/Product"
import { SaleModel } from "@/models/Sale"

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
  const existingImage = formData.get("existingImage") ? String(formData.get("existingImage")) : undefined
  const imageFile = formData.get("image") instanceof File ? (formData.get("image") as File) : null

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

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  try {
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (quantityInitial !== undefined) updateData.quantityInitial = quantityInitial
    if (unitPriceForeign !== undefined) updateData.unitPriceForeign = unitPriceForeign
    if (sourceCurrency !== undefined) updateData.sourceCurrency = sourceCurrency
    if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate
    if (externalLink !== undefined) updateData.externalLink = externalLink
    if (batchId !== undefined) {
      updateData.batchId = batchId || null
    }

    // Handle image updates
    if (existingImage !== undefined || imageFile) {
      let image = existingImage ?? ""

      // Upload new image file
      if (imageFile) {
        image = await uploadImageFile(imageFile)
      }

      if (image) {
        updateData.images = [image]
      } else {
        updateData.images = []
      }
    }

    const product = await ProductModel.findByIdAndUpdate(productId, updateData, { new: true, runValidators: true })
      .populate("categoryId", "name")
      .populate("batchId", "batchName")

    if (!product) {
      return errorResponse({ id: "Product not found" }, 404)
    }

    return successResponse({ product })
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
    // Get product with batch info
    const product = await ProductModel.findById(productId).populate("batchId", "batchName")

    if (!product) {
      return errorResponse({ id: "Product not found" }, 404)
    }

    // Check for sales
    const salesCount = await SaleModel.countDocuments({ productId })

    // Prepare deletion data
    const deletionData = {
      productName: product.name,
      hasActiveSales: salesCount > 0,
      salesCount,
      isInBatch: Boolean(product.batchId),
      batchName: product.batchId?.batchName ?? null,
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
