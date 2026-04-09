import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { buildBatchCostInputsFromBatch, calculateBatchProductLandedCosts } from "@/lib/costs"
import { BatchModel } from "@/models/Batch"
import { ProductModel } from "@/models/Product"
import { SaleModel } from "@/models/Sale"

function hasAtLeastOneBatchExpense(numberFields: Record<string, number>) {
  return Object.values(numberFields).some((value) => value > 0)
}

function mapBatchPersistenceError(error: unknown) {
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
    errors.general = "Failed to update batch"
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await context.params
  if (!Types.ObjectId.isValid(id)) {
    return errorResponse({ batchId: "Invalid batch id" }, 400)
  }

  const batch = await BatchModel.findById(id)
  if (!batch) {
    return errorResponse({ batchId: "Batch not found" }, 404)
  }

  const body = await request.json()

  const batchName = String(body.batchName ?? "").trim()
  const trackingId = String(body.trackingId ?? "").trim()
  const pickupMethod = body.pickupMethod === undefined ? String(batch.pickupMethod ?? "advanced") : String(body.pickupMethod ?? "advanced").trim()
  const intlShipping = Number(body.intlShipping ?? 0)
  const intlShippingCurrency = String(body.intlShippingCurrency ?? batch.intlShippingCurrency ?? "RWF").trim() || "RWF"
  const intlShippingExchangeRate = Number(body.intlShippingExchangeRate ?? batch.intlShippingExchangeRate ?? 1)
  const taxValue = Number(body.taxValue ?? 0)
  const collectionFee = body.collectionFee === undefined ? Number(batch.collectionFee ?? 0) : Number(body.collectionFee ?? 0)
  const customsDuties = Number(body.customsDuties ?? 0)
  const declaration = Number(body.declaration ?? 0)
  const arrivalNotif = Number(body.arrivalNotif ?? 0)
  const warehouseStorage = Number(body.warehouseStorage ?? 0)
  const localTransport = body.localTransport === undefined ? Number(batch.localTransport ?? 0) : Number(body.localTransport ?? 0)
  const amazonPrime = Number(body.amazonPrime ?? 0)
  const amazonPrimeCurrency = String(body.amazonPrimeCurrency ?? batch.amazonPrimeCurrency ?? "RWF").trim() || "RWF"
  const amazonPrimeExchangeRate = Number(body.amazonPrimeExchangeRate ?? batch.amazonPrimeExchangeRate ?? 1)
  const warehouseUSA = Number(body.warehouseUSA ?? 0)
  const warehouseUSACurrency = String(body.warehouseUSACurrency ?? batch.warehouseUSACurrency ?? "RWF").trim() || "RWF"
  const warehouseUSAExchangeRate = Number(body.warehouseUSAExchangeRate ?? batch.warehouseUSAExchangeRate ?? 1)
  const miscellaneous = Number(body.miscellaneous ?? 0)

  const errors: FieldErrors = {}

  if (!batchName) errors.batchName = "Batch name is required"
  if (!["easy", "advanced"].includes(pickupMethod)) {
    errors.pickupMethod = "Pickup method must be easy or advanced"
  }

  if (batchName) {
    const existingBatch = await BatchModel.findOne({
      userId: user._id,
      _id: { $ne: batch._id },
      batchName: { $regex: `^${batchName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    })

    if (existingBatch) {
      errors.batchName = "Batch name already exists"
    }
  }

  const currencyFields = {
    intlShippingCurrency,
    amazonPrimeCurrency,
    warehouseUSACurrency,
  }

  for (const [field, value] of Object.entries(currencyFields)) {
    if (!value) {
      errors[field] = "Currency is required"
    }
  }

  if (intlShipping > 0 && intlShippingCurrency !== "RWF" && (!Number.isFinite(intlShippingExchangeRate) || intlShippingExchangeRate <= 0)) {
    errors.intlShippingExchangeRate = "Exchange rate must be greater than 0"
  }
  if (amazonPrime > 0 && amazonPrimeCurrency !== "RWF" && (!Number.isFinite(amazonPrimeExchangeRate) || amazonPrimeExchangeRate <= 0)) {
    errors.amazonPrimeExchangeRate = "Exchange rate must be greater than 0"
  }
  if (warehouseUSA > 0 && warehouseUSACurrency !== "RWF" && (!Number.isFinite(warehouseUSAExchangeRate) || warehouseUSAExchangeRate <= 0)) {
    errors.warehouseUSAExchangeRate = "Exchange rate must be greater than 0"
  }

  const numberFields = {
    intlShipping,
    taxValue,
    collectionFee,
    customsDuties,
    declaration,
    arrivalNotif,
    warehouseStorage,
    localTransport,
    amazonPrime,
    warehouseUSA,
    miscellaneous,
  }

  for (const [key, value] of Object.entries(numberFields)) {
    if (!Number.isFinite(value) || value < 0) {
      errors[key] = "Value must be 0 or higher"
    }
  }

  if (!hasAtLeastOneBatchExpense(numberFields)) {
    errors.general = "Add at least one expense amount"
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  try {
    batch.batchName = batchName
    batch.trackingId = trackingId
    batch.pickupMethod = pickupMethod
    batch.intlShipping = intlShipping
    batch.intlShippingCurrency = intlShippingCurrency
    batch.intlShippingExchangeRate = intlShippingExchangeRate
    batch.taxValue = taxValue
    batch.collectionFee = collectionFee
    batch.customsDuties = customsDuties
    batch.declaration = declaration
    batch.arrivalNotif = arrivalNotif
    batch.warehouseStorage = warehouseStorage
    batch.localTransport = localTransport
    batch.amazonPrime = amazonPrime
    batch.amazonPrimeCurrency = amazonPrimeCurrency
    batch.amazonPrimeExchangeRate = amazonPrimeExchangeRate
    batch.warehouseUSA = warehouseUSA
    batch.warehouseUSACurrency = warehouseUSACurrency
    batch.warehouseUSAExchangeRate = warehouseUSAExchangeRate
    batch.miscellaneous = miscellaneous

    await batch.save()
    await recalculateBatchProducts(id)

    const hydratedBatch = await BatchModel.findById(id).lean()
    return successResponse({ batch: hydratedBatch })
  } catch (error) {
    return errorResponse(mapBatchPersistenceError(error), 400)
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await context.params
  if (!Types.ObjectId.isValid(id)) {
    return errorResponse({ batchId: "Invalid batch id" }, 400)
  }

  try {
    const batch = await BatchModel.findOne({ _id: id, userId: user._id })
    if (!batch) {
      return errorResponse({ batchId: "Batch not found" }, 404)
    }

    // Get all products in this batch
    const productsInBatch = await ProductModel.find({ batchId: id, userId: user._id }).lean()
    const productIds = productsInBatch.map((p) => p._id)

    // Count total sales for products in this batch
    const salesCount = await SaleModel.countDocuments({ productId: { $in: productIds }, userId: user._id })

    // Prepare deletion data
    const deletionData = {
      batchName: batch.batchName,
      productCount: productsInBatch.length,
      hasActiveSales: salesCount > 0,
      salesCount,
    }

    const { searchParams } = new URL(request.url)
    const isConfirmed = searchParams.get("confirm") === "true"

    if (!isConfirmed) {
      // First call - return deletion info without deleting
      return successResponse({
        message: "Batch deletion check",
        deletionInfo: deletionData,
      })
    }

    // Delete the batch
    await BatchModel.findByIdAndDelete(id)
    
    // Unassign products from the batch
    if (productIds.length > 0) {
      await ProductModel.updateMany({ _id: { $in: productIds } }, { batchId: null })
    }

    return successResponse({
      message: "Batch deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting batch:", error)
    return errorResponse({ message: "Failed to delete batch" }, 500)
  }
}
