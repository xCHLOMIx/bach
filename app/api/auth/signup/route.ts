import bcrypt from "bcryptjs"
import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { setAuthCookie, signAuthToken } from "@/lib/auth"
import { UserModel } from "@/models/User"

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const body = await request.json()
  const firstName = String(body.firstName ?? "").trim()
  const lastName = String(body.lastName ?? "").trim()
  const phoneNumber = String(body.phoneNumber ?? "").trim()
  const password = String(body.password ?? "")

  const errors: FieldErrors = {}

  if (!firstName) errors.firstName = "First name is required"
  if (!lastName) errors.lastName = "Last name is required"
  if (!phoneNumber) errors.phoneNumber = "Phone number is required"
  if (!password) errors.password = "Password is required"

  if (password && password.length < 8) {
    errors.password = "Password must be at least 8 characters long"
  }

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  const existing = await UserModel.findOne({ phoneNumber }).lean()
  if (existing) {
    return errorResponse({ phoneNumber: "Phone number is already taken" }, 409)
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await UserModel.create({
    firstName,
    lastName,
    phoneNumber,
    password: hashedPassword,
  })

  const token = signAuthToken(String(user._id))
  await setAuthCookie(token)

  return successResponse(
    {
      user: {
        id: String(user._id),
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
      },
    },
    201
  )
}
