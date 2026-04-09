import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
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
    errors.general = "Failed to create batch"
  }

  return errors
}

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const batches = await BatchModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean()

  if (batches.length === 0) {
    return successResponse({ batches: [] })
  }

  const batchIds = batches.map((batch) => batch._id)
  const itemCounts = await ProductModel.aggregate<{ _id: string; count: number }>([
    { $match: { userId: user._id, batchId: { $in: batchIds } } },
    { $group: { _id: "$batchId", count: { $sum: 1 } } },
  ])

  const countsMap = new Map(itemCounts.map((entry) => [String(entry._id), entry.count]))

  return successResponse({
    batches: batches.map((batch) => ({
      ...batch,
      productCount: countsMap.get(String(batch._id)) ?? 0,
    })),
  })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const body = await request.json()

  const batchName = String(body.batchName ?? "").trim()
  const trackingId = String(body.trackingId ?? "").trim()
  const pickupMethod = String(body.pickupMethod ?? "advanced").trim()
  const intlShipping = Number(body.intlShipping ?? 0)
  const intlShippingCurrency = String(body.intlShippingCurrency ?? "RWF").trim() || "RWF"
  const intlShippingExchangeRate = Number(body.intlShippingExchangeRate ?? 1)
  const taxValue = Number(body.taxValue ?? 0)
  const collectionFee = Number(body.collectionFee ?? 0)
  const customsDuties = Number(body.customsDuties ?? 0)
  const declaration = Number(body.declaration ?? 0)
  const arrivalNotif = Number(body.arrivalNotif ?? 0)
  const warehouseStorage = Number(body.warehouseStorage ?? 0)
  const localTransport = Number(body.localTransport ?? 0)
  const amazonPrime = Number(body.amazonPrime ?? 0)
  const amazonPrimeCurrency = String(body.amazonPrimeCurrency ?? "RWF").trim() || "RWF"
  const amazonPrimeExchangeRate = Number(body.amazonPrimeExchangeRate ?? 1)
  const warehouseUSA = Number(body.warehouseUSA ?? 0)
  const warehouseUSACurrency = String(body.warehouseUSACurrency ?? "RWF").trim() || "RWF"
  const warehouseUSAExchangeRate = Number(body.warehouseUSAExchangeRate ?? 1)
  const miscellaneous = Number(body.miscellaneous ?? 0)

  const errors: FieldErrors = {}

  if (!batchName) errors.batchName = "Batch name is required"
  if (!["easy", "advanced"].includes(pickupMethod)) {
    errors.pickupMethod = "Pickup method must be easy or advanced"
  }

  if (batchName) {
    const existingBatch = await BatchModel.findOne({
      userId: user._id,
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
    const batch = await BatchModel.create({
      userId: user._id,
      batchName,
      trackingId,
      pickupMethod,
      intlShipping,
      intlShippingCurrency,
      intlShippingExchangeRate,
      taxValue,
      collectionFee,
      customsDuties,
      declaration,
      arrivalNotif,
      warehouseStorage,
      localTransport,
      amazonPrime,
      amazonPrimeCurrency,
      amazonPrimeExchangeRate,
      warehouseUSA,
      warehouseUSACurrency,
      warehouseUSAExchangeRate,
      miscellaneous,
    })

    return successResponse({ batch }, 201)
  } catch (error) {
    return errorResponse(mapBatchPersistenceError(error), 400)
  }
}
