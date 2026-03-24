import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { CategoryModel } from "@/models/Category"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const categories = await CategoryModel.find().sort({ createdAt: -1 }).lean()
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

  const exists = await CategoryModel.findOne({ name }).lean()
  if (exists) {
    return errorResponse({ name: "Category already exists" }, 409)
  }

  const category = await CategoryModel.create({ name })
  return successResponse({ category }, 201)
}
