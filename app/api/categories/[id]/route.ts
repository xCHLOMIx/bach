import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { CategoryModel } from "@/models/Category"

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await context.params
  if (!Types.ObjectId.isValid(id)) {
    return errorResponse({ id: "Invalid category id" }, 400)
  }

  const body = await request.json()
  const name = String(body.name ?? "").trim()
  if (!name) {
    return errorResponse({ name: "Category name is required" }, 400)
  }

  const duplicate = await CategoryModel.findOne({
    _id: { $ne: id },
    name,
  }).lean()
  if (duplicate) {
    return errorResponse({ name: "Category already exists" }, 409)
  }

  const category = await CategoryModel.findByIdAndUpdate(
    id,
    { name },
    { new: true }
  ).lean()

  if (!category) {
    return errorResponse({ id: "Category not found" }, 404)
  }

  return successResponse({ category })
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await context.params
  if (!Types.ObjectId.isValid(id)) {
    return errorResponse({ id: "Invalid category id" }, 400)
  }

  const deleted = await CategoryModel.findByIdAndDelete(id).lean()
  if (!deleted) {
    return errorResponse({ id: "Category not found" }, 404)
  }

  return successResponse({ ok: true })
}
