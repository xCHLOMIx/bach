import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { BusinessMemberModel } from "@/models/BusinessMember"
import { UserModel } from "@/models/User"
import { normalizePhoneNumber } from "@/lib/phone"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  const members = await BusinessMemberModel.find({ ownerId: user._id })
    .populate("userId", "firstName lastName phoneNumber createdAt")
    .sort({ createdAt: -1 })
    .lean()
  
  return successResponse({ members })
}

export async function POST(request: NextRequest) {
  await connectToDatabase()

  const currentUser = await getAuthorizedUser(request)
  if (!currentUser) return errorResponse({ auth: "Unauthorized" }, 401)

  const body = await request.json()
  const firstName = String(body.firstName ?? "").trim()
  const lastName = String(body.lastName ?? "").trim()
  const phoneNumber = normalizePhoneNumber(String(body.phoneNumber ?? "").trim())
  const password = String(body.password ?? "")

  const errors: FieldErrors = {}
  if (!firstName) errors.firstName = "First name is required"
  if (!lastName) errors.lastName = "Last name is required"
  if (!phoneNumber) errors.phoneNumber = "Phone number is required"
  if (!password) errors.password = "Password is required"

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  // Check if a user with this phone number already exists
  let memberUser = await UserModel.findOne({ phoneNumber }).lean()

  if (memberUser) {
    return errorResponse({ phoneNumber: "Phone number already registered" }, 409)
  }

  // Create new user since it does not exist
  const hashedPassword = await bcrypt.hash(password, 10)
  memberUser = await UserModel.create({
    firstName,
    lastName,
    phoneNumber,
    password: hashedPassword,
  })

  // Create relationship
  await BusinessMemberModel.create({
    ownerId: currentUser._id,
    userId: memberUser._id,
  })
  
  return successResponse({ message: "Member added successfully" }, 201)
}
