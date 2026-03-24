import bcrypt from "bcryptjs"
import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { setAuthCookie, signAuthToken } from "@/lib/auth"
import { UserModel } from "@/models/User"

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const body = await request.json()
  const phoneNumber = String(body.phoneNumber ?? "").trim()
  const password = String(body.password ?? "")

  const errors: FieldErrors = {}

  if (!phoneNumber) errors.phoneNumber = "Phone number is required"
  if (!password) errors.password = "Password is required"

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const user = await UserModel.findOne({ phoneNumber })
  if (!user) {
    return errorResponse({ phoneNumber: "Account not found" }, 404)
  }

  const isMatch = await bcrypt.compare(password, user.password)
  if (!isMatch) {
    return errorResponse({ password: "Incorrect password" }, 401)
  }

  const token = signAuthToken(String(user._id))
  await setAuthCookie(token)

  return successResponse({
    user: {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
    },
  })
}
