import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { BatchModel } from "@/models/Batch"
import { ProductModel } from "@/models/Product"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const batches = await BatchModel.find().sort({ createdAt: -1 }).lean()

  const batchIds = batches.map((batch) => batch._id)
  const itemCounts = await ProductModel.aggregate<{ _id: string; count: number }>([
    { $match: { batchId: { $in: batchIds } } },
    { $group: { _id: "$batchId", count: { $sum: 1 } } },
  ])

  const groupedProducts = await ProductModel.aggregate<{
    _id: string
    products: Array<{ _id: string; name: string; quantityRemaining: number }>
  }>([
    { $match: { batchId: { $in: batchIds } } },
    {
      $group: {
        _id: "$batchId",
        products: {
          $push: {
            _id: "$_id",
            name: "$name",
            quantityRemaining: "$quantityRemaining",
          },
        },
      },
    },
  ])

  const countsMap = new Map(itemCounts.map((entry) => [String(entry._id), entry.count]))
  const productsMap = new Map(
    groupedProducts.map((entry) => [String(entry._id), entry.products])
  )

  return successResponse({
    batches: batches.map((batch) => ({
      ...batch,
      productCount: countsMap.get(String(batch._id)) ?? 0,
      products: productsMap.get(String(batch._id)) ?? [],
    })),
  })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

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

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const batch = await BatchModel.create({
    batchName,
    intlShipping,
    taxValue,
    customsDuties,
    declaration,
    arrivalNotif,
    warehouseStorage,
    amazonPrime,
    warehouseUSA,
    miscellaneous,
  })

  return successResponse({ batch }, 201)
}
