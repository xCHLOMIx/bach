import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { CategoryModel } from "@/models/Category"
import { getOrCompute, clearCacheByPrefix } from "@/lib/cache"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  // Cache categories for 5 minutes (categories don't change frequently)
  const categories = await getOrCompute(
    `categories:${user._id}`,
    () => CategoryModel.find({ userId: user._id }).sort({ createdAt: -1 }).lean(),
    300
  )
  
  return successResponse({ categories })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const body = await request.json()
  const name = String(body.name ?? "").trim()

  const errors: FieldErrors = {}
  if (!name) errors.name = "Category name is required"

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const exists = await CategoryModel.findOne({ userId: user._id, name }).lean()
  if (exists) {
    return errorResponse({ name: "Category already exists" }, 409)
  }

  const category = await CategoryModel.create({ userId: user._id, name })
  
  // Invalidate cache when new category is created
  clearCacheByPrefix(`categories:${user._id}`)
  
  return successResponse({ category }, 201)
}
