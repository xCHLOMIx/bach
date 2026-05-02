import { NextRequest } from "next/server"
import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { CategoryModel } from "@/models/Category"
import { ProductModel } from "@/models/Product"

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await context.params
  if (!Types.ObjectId.isValid(id)) {
    return errorResponse({ categoryId: "Invalid category id" }, 400)
  }

  const category = await CategoryModel.findOne({ _id: id, userId: user._id }).lean()
  if (!category) {
    return errorResponse({ categoryId: "Category not found" }, 404)
  }

  const body = await request.json()
  const productIds = (body.productIds ?? []) as string[]

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return errorResponse({ productIds: "At least one product is required" }, 400)
  }

  for (let i = 0; i < productIds.length; i += 1) {
    if (!Types.ObjectId.isValid(productIds[i])) {
      return errorResponse({ [`productIds.${i}`]: "Invalid product id" }, 400)
    }
  }

  await ProductModel.updateMany(
    { _id: { $in: productIds }, userId: user._id },
    { $set: { categoryId: new Types.ObjectId(id) } }
  )

  return successResponse({ ok: true })
}
