import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { CategoryModel } from "@/models/Category"
import { ProductModel } from "@/models/Product"

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
    { returnDocument: 'after' }
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

  const confirmDelete = request.nextUrl.searchParams.get("confirm") === "true"

  const category = await CategoryModel.findOne({ _id: id, userId: user._id }).lean()
  if (!category) {
    return errorResponse({ id: "Category not found" }, 404)
  }

  const productCount = await ProductModel.countDocuments({
    userId: user._id,
    categoryId: id,
  })

  if (!confirmDelete) {
    return successResponse({
      deletionInfo: {
        categoryName: category.name,
        productCount,
        hasLinkedProducts: productCount > 0,
      },
    })
  }

  await CategoryModel.deleteOne({ _id: id, userId: user._id })
  await ProductModel.updateMany(
    { userId: user._id, categoryId: id },
    { $set: { categoryId: null } }
  )

  return successResponse({ ok: true })
}
