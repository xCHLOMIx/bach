import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { GroupModel } from "@/models/Group"
import { ProductModel } from "@/models/Product"

function parseProductIds(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return Array.from(new Set(value.map((entry) => String(entry).trim()).filter(Boolean)))
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const groupId = (await params).id
  if (!Types.ObjectId.isValid(groupId)) {
    return errorResponse({ id: "Invalid group ID" }, 400)
  }

  const group = await GroupModel.findOne({ _id: groupId, userId: user._id }).lean().exec()
  if (!group) {
    return errorResponse({ id: "Group not found" }, 404)
  }

  return successResponse({ group })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const groupId = (await params).id
  if (!Types.ObjectId.isValid(groupId)) {
    return errorResponse({ id: "Invalid group ID" }, 400)
  }

  const group = await GroupModel.findOne({ _id: groupId, userId: user._id }).lean().exec()
  if (!group) {
    return errorResponse({ id: "Group not found" }, 404)
  }

  const body = (await request.json().catch(() => null)) as { name?: string; productIds?: string[]; items?: GroupItemInput[] } | null
  const name = body?.name !== undefined ? String(body.name).trim() : undefined
  const productIds = body?.productIds !== undefined ? parseProductIds(body.productIds) : undefined
  const parsedItems = body?.items !== undefined ? parseItemsInput(body.items) : undefined

  const items = parsedItems !== undefined
    ? parsedItems
    : productIds !== undefined
      ? productIds.map((productId) => ({ productId, quantity: 1 }))
      : undefined

  const effectiveProductIds = items !== undefined ? items.map((item) => item.productId) : productIds

  const errors: FieldErrors = {}
  if (name !== undefined && !name) {
    errors.name = "Group name is required"
  }
  if (effectiveProductIds !== undefined) {
    if (effectiveProductIds.length === 0) {
      errors.productIds = "Select at least one product"
    } else if (effectiveProductIds.some((id) => !Types.ObjectId.isValid(id))) {
      errors.productIds = "One or more products are invalid"
    }
  }
  if (items !== undefined && items.some((item) => !Number.isInteger(item.quantity) || item.quantity <= 0)) {
    errors.productIds = "Selected quantities must be whole numbers greater than 0"
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  if (effectiveProductIds !== undefined) {
    const selectedProducts = await ProductModel.find({ _id: { $in: effectiveProductIds }, userId: user._id }).lean().exec()
    if (selectedProducts.length !== effectiveProductIds.length) {
      return errorResponse({ productIds: "One or more products were not found" }, 404)
    }

    if (items !== undefined) {
      const quantityByProductId = new Map(items.map((item) => [item.productId, item.quantity]))
      const exceedsAvailable = selectedProducts.some((product) => {
        const selectedQuantity = quantityByProductId.get(String(product._id)) ?? 0
        return selectedQuantity > Math.max(0, product.quantityRemaining ?? 0)
      })
      if (exceedsAvailable) {
        return errorResponse({ productIds: "One or more selected quantities exceed available stock" }, 400)
      }
    }

    const otherGroups = await GroupModel.find({ userId: user._id, _id: { $ne: groupId } }).lean().exec()
    const groupedProductIds = new Set(otherGroups.flatMap((entry) => entry.productIds.map((id: unknown) => String(id))))
    const overlapping = effectiveProductIds.filter((id) => groupedProductIds.has(id))
    if (overlapping.length > 0) {
      return errorResponse({ productIds: "One or more selected products already belong to a group" }, 400)
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (effectiveProductIds !== undefined) updateData.productIds = effectiveProductIds
  if (items !== undefined) updateData.items = items

  const updatedGroup = await GroupModel.findOneAndUpdate(
    { _id: groupId, userId: user._id },
    { $set: updateData },
    { new: true }
  ).lean().exec()

  return successResponse({ group: updatedGroup })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const groupId = (await params).id
  if (!Types.ObjectId.isValid(groupId)) {
    return errorResponse({ id: "Invalid group ID" }, 400)
  }

  const deleted = await GroupModel.findOneAndDelete({ _id: groupId, userId: user._id }).lean().exec()
  if (!deleted) {
    return errorResponse({ id: "Group not found" }, 404)
  }

  return successResponse({ ok: true })
}