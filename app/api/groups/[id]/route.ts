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

  const body = (await request.json().catch(() => null)) as { name?: string; productIds?: string[] } | null
  const name = body?.name !== undefined ? String(body.name).trim() : undefined
  const productIds = body?.productIds !== undefined ? parseProductIds(body.productIds) : undefined

  const errors: FieldErrors = {}
  if (name !== undefined && !name) {
    errors.name = "Group name is required"
  }
  if (productIds !== undefined) {
    if (productIds.length === 0) {
      errors.productIds = "Select at least one product"
    } else if (productIds.some((id) => !Types.ObjectId.isValid(id))) {
      errors.productIds = "One or more products are invalid"
    }
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  if (productIds !== undefined) {
    const selectedProducts = await ProductModel.find({ _id: { $in: productIds }, userId: user._id }).lean().exec()
    if (selectedProducts.length !== productIds.length) {
      return errorResponse({ productIds: "One or more products were not found" }, 404)
    }

    const otherGroups = await GroupModel.find({ userId: user._id, _id: { $ne: groupId } }).lean().exec()
    const groupedProductIds = new Set(otherGroups.flatMap((entry) => entry.productIds.map((id) => String(id))))
    const overlapping = productIds.filter((id) => groupedProductIds.has(id))
    if (overlapping.length > 0) {
      return errorResponse({ productIds: "One or more selected products already belong to a group" }, 400)
    }
  }

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name
  if (productIds !== undefined) updateData.productIds = productIds

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