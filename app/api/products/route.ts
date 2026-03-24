import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { uploadImageFile } from "@/lib/cloudinary"
import { ProductModel } from "@/models/Product"

const SUPPORTED_SOURCE_CURRENCIES = ["RWF", "USD", "KSH", "UGX", "AED", "EUR", "GBP"]

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const products = await ProductModel.find()
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
  const quantityInitial = Number(formData.get("quantityInitial") ?? 0)
  const unitPriceForeign = Number(formData.get("unitPriceForeign") ?? 0)
  const sourceCurrency = String(formData.get("sourceCurrency") ?? "").trim().toUpperCase()
  const exchangeRate = Number(formData.get("exchangeRate") ?? 1)
  const images = formData.getAll("images").filter((entry) => entry instanceof File) as File[]

  const errors: FieldErrors = {}

  if (!name) errors.name = "Product name is required"
  if (!categoryId) errors.categoryId = "Category is required"
  if (categoryId && !Types.ObjectId.isValid(categoryId)) {
    errors.categoryId = "Invalid category"
  }
  if (!Number.isFinite(quantityInitial) || quantityInitial < 0) {
    errors.quantityInitial = "Initial quantity must be 0 or higher"
  }
  if (!Number.isFinite(unitPriceForeign) || unitPriceForeign < 0) {
    errors.unitPriceForeign = "Unit price must be 0 or higher"
  }
  if (!sourceCurrency) errors.sourceCurrency = "Source currency is required"
  if (sourceCurrency && !SUPPORTED_SOURCE_CURRENCIES.includes(sourceCurrency)) {
    errors.sourceCurrency = "Select a supported source currency"
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    errors.exchangeRate = "Exchange rate must be greater than 0"
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
    name,
    categoryId,
    batchId: null,
    quantityInitial,
    quantityRemaining: quantityInitial,
    unitPriceForeign,
    sourceCurrency,
    exchangeRate: resolvedExchangeRate,
    unitPriceLocalRWF,
    purchasePriceRWF: unitPriceLocalRWF,
    landedCost: unitPriceLocalRWF,
    images: uploadedUrls,
  })

  const hydratedProduct = await ProductModel.findById(product._id)
    .populate("categoryId", "name")
    .populate("batchId", "batchName")
    .lean()

  return successResponse({ product: hydratedProduct }, 201)
}
