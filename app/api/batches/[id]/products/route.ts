import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { calculateBatchProductLandedCosts } from "@/lib/costs"
import { BatchModel } from "@/models/Batch"
import { ProductModel } from "@/models/Product"

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

export async function GET(
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

  const products = await ProductModel.find({ batchId: id })
    .populate("categoryId", "name")
    .sort({ createdAt: -1 })
    .lean()

  return successResponse({ products })
}

export async function POST(
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

  const batch = await BatchModel.findById(id).lean()
  if (!batch) {
    return errorResponse({ batchId: "Batch not found" }, 404)
  }

  const body = await request.json()
  const productIds = (body.productIds ?? []) as string[]

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return errorResponse({ productIds: "At least one product is required" }, 400)
  }

  for (let i = 0; i < productIds.length; i += 1) {
    if (!Types.ObjectId.isValid(productIds[i])) {
      return errorResponse({ [`productIds.${i}`]: "Invalid product id" }, 400)
    }
  }

  const productsToAssign = await ProductModel.find({ _id: { $in: productIds } })
    .select("batchId")
    .lean()
  const previousBatchIds = new Set(
    productsToAssign
      .map((product) => (product.batchId ? String(product.batchId) : ""))
      .filter(Boolean)
  )

  await ProductModel.updateMany(
    { _id: { $in: productIds } },
    { $set: { batchId: new Types.ObjectId(id) } }
  )

  await recalculateBatchProducts(id)

  for (const previousBatchId of previousBatchIds) {
    if (previousBatchId !== id) {
      await recalculateBatchProducts(previousBatchId)
    }
  }

  const products = await ProductModel.find({ batchId: id })
    .populate("categoryId", "name")
    .sort({ createdAt: -1 })
    .lean()

  return successResponse({ products })
}
