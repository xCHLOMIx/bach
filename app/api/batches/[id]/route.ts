import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { calculateBatchProductLandedCosts } from "@/lib/costs"
import { BatchModel } from "@/models/Batch"
import { ProductModel } from "@/models/Product"

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
  const intlShipping = Number(body.intlShipping ?? 0)
  const taxValue = Number(body.taxValue ?? 0)
  const customsDuties = Number(body.customsDuties ?? 0)
  const declaration = Number(body.declaration ?? 0)
  const arrivalNotif = Number(body.arrivalNotif ?? 0)
  const warehouseStorage = Number(body.warehouseStorage ?? 0)
  const amazonPrime = Number(body.amazonPrime ?? 0)
  const warehouseUSA = Number(body.warehouseUSA ?? 0)
  const miscellaneous = Number(body.miscellaneous ?? 0)

  const errors: FieldErrors = {}

  if (!batchName) errors.batchName = "Batch name is required"

  const numberFields = {
    intlShipping,
    taxValue,
    customsDuties,
    declaration,
    arrivalNotif,
    warehouseStorage,
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
    batch.intlShipping = intlShipping
    batch.taxValue = taxValue
    batch.customsDuties = customsDuties
    batch.declaration = declaration
    batch.arrivalNotif = arrivalNotif
    batch.warehouseStorage = warehouseStorage
    batch.amazonPrime = amazonPrime
    batch.warehouseUSA = warehouseUSA
    batch.miscellaneous = miscellaneous

    await batch.save()
    await recalculateBatchProducts(id)

    const hydratedBatch = await BatchModel.findById(id).lean()
    return successResponse({ batch: hydratedBatch })
  } catch (error) {
    return errorResponse(mapBatchPersistenceError(error), 400)
  }
}
