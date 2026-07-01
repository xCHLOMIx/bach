import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse, type FieldErrors } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { BusinessMemberModel } from "@/models/BusinessMember"
import { UserModel } from "@/models/User"
import { normalizePhoneNumber } from "@/lib/phone"

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const currentUser = await getAuthorizedUser(request)
  if (!currentUser) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await params

  // Verify the business member exists and belongs to the current user
  const member = await BusinessMemberModel.findOne({ _id: id, ownerId: currentUser._id })
  if (!member) {
    return errorResponse({ general: "Member not found" }, 404)
  }

  const body = await request.json()
  const firstName = String(body.firstName ?? "").trim()
  const lastName = String(body.lastName ?? "").trim()
  const phoneNumber = normalizePhoneNumber(String(body.phoneNumber ?? "").trim())
  const password = String(body.password ?? "")

  const errors: FieldErrors = {}
  if (!firstName) errors.firstName = "First name is required"
  if (!lastName) errors.lastName = "Last name is required"
  if (!phoneNumber) errors.phoneNumber = "Phone number is required"

  if (Object.keys(errors).length > 0) {
    return errorResponse(errors, 400)
  }

  // Check if phone number is taken by someone else
  const existingUser = await UserModel.findOne({ phoneNumber }).lean()
  if (existingUser && existingUser._id.toString() !== member.userId.toString()) {
    return errorResponse({ phoneNumber: "Phone number is already in use by another user" }, 409)
  }

  // Update user
  const updateData: any = { firstName, lastName, phoneNumber }
  if (password) {
    updateData.password = await bcrypt.hash(password, 10)
  }

  await UserModel.findByIdAndUpdate(member.userId, updateData)

  return successResponse({ message: "Member updated successfully" })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase()

  const currentUser = await getAuthorizedUser(request)
  if (!currentUser) return errorResponse({ auth: "Unauthorized" }, 401)

  const { id } = await params

  const member = await BusinessMemberModel.findOneAndDelete({ _id: id, ownerId: currentUser._id })
  
  if (!member) {
    return errorResponse({ general: "Member not found" }, 404)
  }

  return successResponse({ message: "Member removed successfully" })
}
