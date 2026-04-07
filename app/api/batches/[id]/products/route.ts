import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { buildBatchCostInputsFromBatch, calculateBatchProductLandedCosts } from "@/lib/costs"
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

async function resetUnassignedProductsCosts(productIds: string[]) {
  if (productIds.length === 0) {
    return
  }

  const unassignedProducts = await ProductModel.find({ _id: { $in: productIds } })
    .select("_id purchasePriceRWF")
    .lean()

  const operations = unassignedProducts.map((product) => ({
    updateOne: {
      filter: { _id: product._id },
      update: { $set: { landedCost: product.purchasePriceRWF } },
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

export async function PUT(
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

  if (!Array.isArray(productIds)) {
    return errorResponse({ productIds: "productIds must be an array" }, 400)
  }

  for (let i = 0; i < productIds.length; i += 1) {
    if (!Types.ObjectId.isValid(productIds[i])) {
      return errorResponse({ [`productIds.${i}`]: "Invalid product id" }, 400)
    }
  }

  const desiredProductIdSet = new Set(productIds)

  const currentBatchProducts = await ProductModel.find({ batchId: id })
    .select("_id")
    .lean()

  const currentBatchProductIds = currentBatchProducts.map((product) => String(product._id))
  const idsToUnassign = currentBatchProductIds.filter(
    (productId) => !desiredProductIdSet.has(productId)
  )

  const productsToAssign = await ProductModel.find({ _id: { $in: productIds } })
    .select("batchId")
    .lean()
  const previousBatchIds = new Set(
    productsToAssign
      .map((product) => (product.batchId ? String(product.batchId) : ""))
      .filter((batchId) => batchId && batchId !== id)
  )

  if (productIds.length > 0) {
    await ProductModel.updateMany(
      { _id: { $in: productIds } },
      { $set: { batchId: new Types.ObjectId(id) } }
    )
  }

  if (idsToUnassign.length > 0) {
    await ProductModel.updateMany(
      { _id: { $in: idsToUnassign } },
      { $set: { batchId: null } }
    )
    await resetUnassignedProductsCosts(idsToUnassign)
  }

  await recalculateBatchProducts(id)

  for (const previousBatchId of previousBatchIds) {
    await recalculateBatchProducts(previousBatchId)
  }

  const products = await ProductModel.find({ batchId: id })
    .populate("categoryId", "name")
    .sort({ createdAt: -1 })
    .lean()

  return successResponse({ products })
}
