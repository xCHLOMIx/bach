import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { uploadImageFile } from "@/lib/cloudinary"
import { ProductModel } from "@/models/Product"
import "@/models/Category"
import "@/models/Batch"

const SUPPORTED_SOURCE_CURRENCIES = ["USD", "RWF", "CNY", "AED"]

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const products = await ProductModel.find({ userId: user._id })
    .populate("categoryId", "name")
    .populate("batchId", "batchName")
    .sort({ createdAt: -1 })
    .lean()

  return successResponse({ products })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const formData = await request.formData()

  const name = String(formData.get("name") ?? "").trim()
  const categoryId = String(formData.get("categoryId") ?? "").trim()
  const rawQuantityInitial = String(formData.get("quantityInitial") ?? "").trim()
  const rawUnitPriceForeign = String(formData.get("unitPriceForeign") ?? "").trim()
  const sourceCurrency = String(formData.get("sourceCurrency") ?? "").trim().toUpperCase()
  const rawExchangeRate = String(formData.get("exchangeRate") ?? "").trim()
  const externalLink = String(formData.get("externalLink") ?? "").trim()
  const images = formData.getAll("images").filter((entry) => entry instanceof File) as File[]

  const quantityInitial = Number(rawQuantityInitial)
  const unitPriceForeign = Number(rawUnitPriceForeign)
  const exchangeRate = Number(rawExchangeRate)

  const errors: FieldErrors = {}

  if (!name) errors.name = "Product name is required"
  if (categoryId && !Types.ObjectId.isValid(categoryId)) {
    errors.categoryId = "Invalid category"
  }
  if (!rawQuantityInitial) {
    errors.quantityInitial = "Initial quantity is required"
  } else if (!Number.isFinite(quantityInitial) || quantityInitial < 0) {
    errors.quantityInitial = "Initial quantity must be 0 or higher"
  }
  if (!rawUnitPriceForeign) {
    errors.unitPriceForeign = "Unit price is required"
  } else if (!Number.isFinite(unitPriceForeign) || unitPriceForeign < 0) {
    errors.unitPriceForeign = "Unit price must be 0 or higher"
  }
  if (!sourceCurrency) errors.sourceCurrency = "Source currency is required"
  if (sourceCurrency && !SUPPORTED_SOURCE_CURRENCIES.includes(sourceCurrency)) {
    errors.sourceCurrency = "Select a supported source currency"
  }
  if (sourceCurrency !== "RWF" && !rawExchangeRate) {
    errors.exchangeRate = "Exchange rate is required"
  } else if (sourceCurrency !== "RWF" && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
    errors.exchangeRate = "Exchange rate must be greater than 0"
  }
  if (externalLink) {
    try {
      new URL(externalLink)
    } catch {
      errors.externalLink = "Enter a valid URL"
    }
  }
  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const uploadedUrls: string[] = []
  for (const image of images) {
    const url = await uploadImageFile(image)
    uploadedUrls.push(url)
  }

  const resolvedExchangeRate = sourceCurrency === "RWF" ? 1 : exchangeRate
  const unitPriceLocalRWF = unitPriceForeign * resolvedExchangeRate

  const product = await ProductModel.create({
    userId: user._id,
    name,
    categoryId: categoryId || null,
    batchId: null,
    quantityInitial,
    quantityRemaining: quantityInitial,
    unitPriceForeign,
    sourceCurrency,
    exchangeRate: resolvedExchangeRate,
    unitPriceLocalRWF,
    purchasePriceRWF: unitPriceLocalRWF,
    landedCost: unitPriceLocalRWF,
    externalLink,
    images: uploadedUrls,
  })

  const hydratedProduct = await ProductModel.findById(product._id)
    .populate("categoryId", "name")
    .populate("batchId", "batchName")
    .lean()

  return successResponse({ product: hydratedProduct }, 201)
}
