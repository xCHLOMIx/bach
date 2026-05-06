import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { GroupModel } from "@/models/Group"
import { ProductModel } from "@/models/Product"
import "@/models/Batch"

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

type GroupItemInput = {
  productId: string
  quantity: number
}

function parseItemsInput(value: unknown): GroupItemInput[] {
  if (!Array.isArray(value)) {
    return []
  }

  const itemsByProductId = new Map<string, number>()

  for (const entry of value) {
    const productId = String((entry as { productId?: unknown })?.productId ?? "").trim()
    const quantity = Number((entry as { quantity?: unknown })?.quantity)
    if (!productId) {
      continue
    }

    itemsByProductId.set(productId, Math.floor(quantity))
  }

  return Array.from(itemsByProductId.entries()).map(([productId, quantity]) => ({ productId, quantity }))
}

function normalizeGroupItems(group: { productIds?: unknown[]; items?: Array<{ productId?: unknown; quantity?: unknown }> }, productsById: Map<string, GroupProduct>) {
  const explicitItems = parseItemsInput(group.items)
  if (explicitItems.length > 0) {
    return explicitItems
  }

  const productIds = Array.isArray(group.productIds)
    ? Array.from(new Set(group.productIds.map((id) => String(id))))
    : []

  return productIds
    .filter((productId) => productsById.has(productId))
    .map((productId) => ({
      productId,
      quantity: Math.max(0, productsById.get(productId)?.quantityRemaining ?? 0),
    }))
}

function summarizeProducts(products: GroupProduct[], quantitiesByProductId: Record<string, number>) {
  const batchNames = Array.from(new Set(products.map((product) => product.batchId?.batchName?.trim()).filter(Boolean) as string[]))
  const batchName = batchNames.length === 0 ? "No batch" : batchNames.length === 1 ? batchNames[0] : "Multiple"

  const purchaseTotal = products.reduce((sum, product) => sum + (product.purchasePriceRWF ?? 0) * Math.max(0, quantitiesByProductId[product._id] ?? 0), 0)
  const landedCostTotal = products.reduce((sum, product) => sum + (product.landedCost ?? 0) * Math.max(0, quantitiesByProductId[product._id] ?? 0), 0)
  const sellingPriceTotal = products.reduce((sum, product) => sum + (typeof product.intendedSellingPrice === "number" ? product.intendedSellingPrice : 0) * Math.max(0, quantitiesByProductId[product._id] ?? 0), 0)

  return {
    batchName,
    purchaseTotal,
    landedCostTotal,
    sellingPriceTotal,
    profitTotal: sellingPriceTotal - landedCostTotal,
  }
}

function mapGroupRows(
  groups: Array<{ _id: string; name: string; productIds: Types.ObjectId[]; items?: Array<{ productId?: unknown; quantity?: unknown }>; createdAt: Date }>,
  productsById: Map<string, GroupProduct>
) {
  return groups.map((group) => {
    const normalizedItems = normalizeGroupItems(group, productsById)
    const quantityByProductId = Object.fromEntries(normalizedItems.map((item) => [item.productId, item.quantity]))

    const groupProducts = normalizedItems
      .map((item) => productsById.get(item.productId))
      .filter(Boolean) as GroupProduct[]

    const summary = summarizeProducts(groupProducts, quantityByProductId)
    return {
      _id: String(group._id),
      type: "group" as const,
      name: group.name,
      productQuantities: quantityByProductId,
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

  const productsById = new Map<string, GroupProduct>(products.map((product) => {
    const gp: GroupProduct = {
      _id: String(product._id),
      name: product.name,
      quantityRemaining: product.quantityRemaining ?? 0,
      purchasePriceRWF: product.purchasePriceRWF ?? 0,
      landedCost: product.landedCost ?? 0,
      intendedSellingPrice: typeof product.intendedSellingPrice === 'number' ? product.intendedSellingPrice : null,
      createdAt: new Date(product.createdAt as string | Date).toISOString(),
      batchId: product.batchId ? { batchName: (product.batchId as { batchName?: string }).batchName } : null,
    }

    return [String(product._id), gp]
  }))
  const groupedProductIds = new Set(groups.flatMap((group) => group.productIds.map((productId: unknown) => String(productId))))

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
        batchName: (product.batchId as { batchName?: string } | null)?.batchName?.trim() || "No batch",
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

  const body = (await request.json().catch(() => null)) as { name?: string; productIds?: string[]; items?: GroupItemInput[] } | null
  const name = String(body?.name ?? "").trim()
  const parsedItems = parseItemsInput(body?.items)
  const fallbackProductIds = Array.isArray(body?.productIds) ? Array.from(new Set(body.productIds.map((id) => String(id).trim()).filter(Boolean))) : []
  const items = parsedItems.length > 0
    ? parsedItems
    : fallbackProductIds.map((productId) => ({ productId, quantity: 1 }))
  const productIds = items.map((item) => item.productId)

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
  if (items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    errors.productIds = "Selected quantities must be whole numbers greater than 0"
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const selectedProducts = await ProductModel.find({ _id: { $in: productIds }, userId: user._id }).lean().exec()
  if (selectedProducts.length !== productIds.length) {
    return errorResponse({ productIds: "One or more products were not found" }, 404)
  }

  const quantityByProductId = new Map(items.map((item) => [item.productId, item.quantity]))
  const exceedsAvailable = selectedProducts.some((product) => {
    const selectedQuantity = quantityByProductId.get(String(product._id)) ?? 0
    return selectedQuantity > Math.max(0, product.quantityRemaining ?? 0)
  })
  if (exceedsAvailable) {
    return errorResponse({ productIds: "One or more selected quantities exceed available stock" }, 400)
  }

  const existingGroups = await GroupModel.find({ userId: user._id }).lean().exec()
  const groupedProductIds = new Set(existingGroups.flatMap((group) => group.productIds.map((id: unknown) => String(id))))
  const overlapping = productIds.filter((id) => groupedProductIds.has(id))
  if (overlapping.length > 0) {
    return errorResponse({ productIds: "One or more selected products already belong to a group" }, 400)
  }

  const group = await GroupModel.create({
    userId: user._id,
    name,
    productIds,
    items,
  })

  return successResponse({ group }, 201)
}