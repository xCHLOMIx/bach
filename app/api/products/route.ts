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

  const searchParams = request.nextUrl.searchParams
  const search = String(searchParams.get("search") ?? "").trim()
  const priceMin = searchParams.get("priceMin") ? Number(searchParams.get("priceMin")) : null
  const priceMax = searchParams.get("priceMax") ? Number(searchParams.get("priceMax")) : null
  const categoriesParam = searchParams.get("categories")
  const batchesParam = searchParams.get("batches")
  const sortColumn = String(searchParams.get("sortColumn") ?? "name")
  const sortDirection = String(searchParams.get("sortDirection") ?? "asc") as "asc" | "desc"

  // Build filter object
  const filter: Record<string, unknown> = { userId: user._id }

  // Search filter
  if (search) {
    filter.name = { $regex: search, $options: "i" }
  }

  // Category filter
  if (categoriesParam) {
    const categoryIds = categoriesParam
      .split(",")
      .filter((id) => id.trim())
      .map((id) => new Types.ObjectId(id.trim()))
    if (categoryIds.length > 0) {
      filter.categoryId = { $in: categoryIds }
    }
  }

  // Batch filter
  if (batchesParam) {
    const batchIds = batchesParam
      .split(",")
      .filter((id) => id.trim())
      .map((id) => new Types.ObjectId(id.trim()))
    if (batchIds.length > 0) {
      filter.batchId = { $in: batchIds }
    }
  }

  // Price filter
  if (priceMin !== null || priceMax !== null) {
    const landedCostFilter: { $gte?: number; $lte?: number } = {}
    if (priceMin !== null) landedCostFilter.$gte = priceMin
    if (priceMax !== null) landedCostFilter.$lte = priceMax
    filter.landedCost = landedCostFilter
  }

  // Build sort object
  const sortObj: Record<string, 1 | -1> = {}
  sortObj[sortColumn] = sortDirection === "asc" ? 1 : -1

  // Execute count and find in parallel (much faster than sequential)
  const [totalCount, products] = await Promise.all([
    ProductModel.countDocuments(filter),
    ProductModel.find(filter)
      .populate("categoryId", "name")
      .populate("batchId", "batchName")
      .sort(sortObj)
      .lean()
      .exec(),
  ])

  return successResponse({ products, totalCount })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const formData = await request.formData()

  const name = String(formData.get("name") ?? "").trim()
  const rawBatchId = String(formData.get("batchId") ?? "").trim()
  const categoryId = String(formData.get("categoryId") ?? "").trim()
  const rawQuantityInitial = String(formData.get("quantityInitial") ?? "").trim()
  const rawUnitPriceForeign = String(formData.get("unitPriceForeign") ?? "").trim()
  const sourceCurrency = String(formData.get("sourceCurrency") ?? "").trim().toUpperCase()
  const rawExchangeRate = String(formData.get("exchangeRate") ?? "").trim()
  const externalLink = String(formData.get("externalLink") ?? "").trim()
  const rawIntendedSellingPrice = String(formData.get("intendedSellingPrice") ?? "").trim()
  const images = formData.getAll("images").filter((entry) => entry instanceof File) as File[]

  const quantityInitial = Number(rawQuantityInitial)
  const unitPriceForeign = Number(rawUnitPriceForeign)
  const exchangeRate = Number(rawExchangeRate)
  const intendedSellingPrice = rawIntendedSellingPrice ? Number(rawIntendedSellingPrice) : null

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
  if (rawIntendedSellingPrice && typeof intendedSellingPrice === "number" && (!Number.isFinite(intendedSellingPrice) || intendedSellingPrice < 0)) {
    errors.intendedSellingPrice = "Selling price must be 0 or higher"
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

  // Determine batch assignment.
  let batchIdValue: string | null = null
  if (rawBatchId) {
    if (!Types.ObjectId.isValid(rawBatchId)) {
      return errorResponse({ batchId: "Invalid batch" }, 400)
    }
    batchIdValue = rawBatchId
  }

  const product = await ProductModel.create({
    userId: user._id,
    name,
    categoryId: categoryId || null,
    batchId: batchIdValue || null,
    quantityInitial,
    quantityRemaining: quantityInitial,
    unitPriceForeign,
    sourceCurrency,
    exchangeRate: resolvedExchangeRate,
    unitPriceLocalRWF,
    purchasePriceRWF: unitPriceLocalRWF,
    landedCost: unitPriceLocalRWF,
    intendedSellingPrice,
    externalLink,
    images: uploadedUrls,
    batchName: "",
  })

  // Return without populate - client has the data they just sent
  return successResponse({ product }, 201)
}
