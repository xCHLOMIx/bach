import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { GroupModel } from "@/models/Group"
import { ProductModel } from "@/models/Product"
import "@/models/Batch"

type GroupRow = {
  _id: string
  type: "group" | "product"
  name: string
  productIds: string[]
  productCount: number
  batchName: string
  createdAt: string
  purchaseTotal: number
  landedCostTotal: number
  sellingPriceTotal: number
  profitTotal: number
}

type GroupProduct = {
  _id: string
  name: string
  quantityRemaining: number
  purchasePriceRWF: number
  landedCost: number
  intendedSellingPrice?: number | null
  createdAt: string
  batchId?: { batchName?: string } | null
}

function summarizeProducts(products: GroupProduct[]) {
  const batchNames = Array.from(new Set(products.map((product) => product.batchId?.batchName?.trim()).filter(Boolean) as string[]))
  const batchName = batchNames.length === 0 ? "No batch" : batchNames.length === 1 ? batchNames[0] : "Multiple"

  const purchaseTotal = products.reduce((sum, product) => sum + (product.purchasePriceRWF ?? 0) * Math.max(0, product.quantityRemaining ?? 0), 0)
  const landedCostTotal = products.reduce((sum, product) => sum + (product.landedCost ?? 0) * Math.max(0, product.quantityRemaining ?? 0), 0)
  const sellingPriceTotal = products.reduce((sum, product) => sum + (typeof product.intendedSellingPrice === "number" ? product.intendedSellingPrice : 0) * Math.max(0, product.quantityRemaining ?? 0), 0)

  return {
    batchName,
    purchaseTotal,
    landedCostTotal,
    sellingPriceTotal,
    profitTotal: sellingPriceTotal - landedCostTotal,
  }
}

function mapGroupRows(groups: Array<{ _id: string; name: string; productIds: Types.ObjectId[]; createdAt: Date }>, productsById: Map<string, GroupProduct>) {
  return groups.map((group) => {
    const groupProducts = group.productIds
      .map((productId) => productsById.get(String(productId)))
      .filter(Boolean) as GroupProduct[]

    const summary = summarizeProducts(groupProducts)
    return {
      _id: String(group._id),
      type: "group" as const,
      name: group.name,
      productIds: groupProducts.map((product) => product._id),
      productCount: groupProducts.length,
      batchName: summary.batchName,
      createdAt: group.createdAt.toISOString(),
      purchaseTotal: summary.purchaseTotal,
      landedCostTotal: summary.landedCostTotal,
      sellingPriceTotal: summary.sellingPriceTotal,
      profitTotal: summary.profitTotal,
    }
  })
}

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const search = String(request.nextUrl.searchParams.get("search") ?? "").trim().toLowerCase()

  const [groups, products] = await Promise.all([
    GroupModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean().exec(),
    ProductModel.find({ userId: user._id }).populate("batchId", "batchName").sort({ createdAt: -1 }).lean().exec(),
  ])

  const productsById = new Map<string, GroupProduct>(products.map((product) => [String(product._id), product as GroupProduct]))
  const groupedProductIds = new Set(groups.flatMap((group) => group.productIds.map((productId) => String(productId))))

  const groupRows = mapGroupRows(groups, productsById)
  const standaloneRows = products
    .filter((product) => !groupedProductIds.has(String(product._id)))
    .map((product) => {
      const quantity = Math.max(0, product.quantityRemaining ?? 0)
      const purchaseTotal = (product.purchasePriceRWF ?? 0) * quantity
      const landedCostTotal = (product.landedCost ?? 0) * quantity
      const sellingPriceTotal = (typeof product.intendedSellingPrice === "number" ? product.intendedSellingPrice : 0) * quantity
      return {
        _id: String(product._id),
        type: "product" as const,
        name: product.name,
        productIds: [String(product._id)],
        productCount: 1,
        batchName: product.batchId?.batchName?.trim() || "No batch",
        createdAt: new Date(product.createdAt as string | Date).toISOString(),
        purchaseTotal,
        landedCostTotal,
        sellingPriceTotal,
        profitTotal: sellingPriceTotal - landedCostTotal,
      }
    })

  const rows = [...groupRows, ...standaloneRows]
    .filter((row) => !search || row.name.toLowerCase().includes(search))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  return successResponse({ rows, products })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const body = (await request.json().catch(() => null)) as { name?: string; productIds?: string[] } | null
  const name = String(body?.name ?? "").trim()
  const productIds = Array.isArray(body?.productIds) ? Array.from(new Set(body.productIds.map((id) => String(id).trim()).filter(Boolean))) : []

  const errors: FieldErrors = {}
  if (!name) {
    errors.name = "Group name is required"
  }
  if (productIds.length === 0) {
    errors.productIds = "Select at least one product"
  }
  if (productIds.some((id) => !Types.ObjectId.isValid(id))) {
    errors.productIds = "One or more products are invalid"
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const selectedProducts = await ProductModel.find({ _id: { $in: productIds }, userId: user._id }).lean().exec()
  if (selectedProducts.length !== productIds.length) {
    return errorResponse({ productIds: "One or more products were not found" }, 404)
  }

  const existingGroups = await GroupModel.find({ userId: user._id }).lean().exec()
  const groupedProductIds = new Set(existingGroups.flatMap((group) => group.productIds.map((id) => String(id))))
  const overlapping = productIds.filter((id) => groupedProductIds.has(id))
  if (overlapping.length > 0) {
    return errorResponse({ productIds: "One or more selected products already belong to a group" }, 400)
  }

  const group = await GroupModel.create({
    userId: user._id,
    name,
    productIds,
  })

  return successResponse({ group }, 201)
}