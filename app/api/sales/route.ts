import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { ProductModel } from "@/models/Product"
import { SaleModel } from "@/models/Sale"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const sales = await SaleModel.find({ userId: user._id })
    .populate("productId", "name")
    .sort({ soldAt: -1 })
    .lean()

  return successResponse({ sales })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const body = await request.json()
  const productId = String(body.productId ?? "").trim()
  const quantity = Number(body.quantity ?? 0)
  const sellingPrice = Number(body.sellingPrice ?? 0)

  const errors: FieldErrors = {}

  if (!productId) errors.productId = "Product is required"
  if (productId && !Types.ObjectId.isValid(productId)) {
    errors.productId = "Invalid product"
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    errors.quantity = "Quantity must be greater than 0"
  }
  if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
    errors.sellingPrice = "Selling price must be 0 or higher"
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const product = await ProductModel.findOne({ _id: productId, userId: user._id })
  if (!product) {
    return errorResponse({ productId: "Product not found" }, 404)
  }

  if (product.quantityRemaining < quantity) {
    return errorResponse({ quantity: "Not enough stock" }, 400)
  }

  const landedCost = product.landedCost
  const profit = sellingPrice - landedCost

  const sale = await SaleModel.create({
    userId: user._id,
    productId,
    quantity,
    sellingPrice,
    landedCost,
    profit,
    soldAt: new Date(),
  })

  product.quantityRemaining -= quantity
  await product.save()

  const hydratedSale = await SaleModel.findById(sale._id)
    .populate("productId", "name")
    .lean()

  return successResponse({ sale: hydratedSale })
}
