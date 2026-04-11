import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { UserModel } from "@/models/User"

export async function PATCH(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) {
    return errorResponse({ auth: "Unauthorized" }, 401)
  }

  const body = await request.json()
  const { firstName, lastName, phoneNumber } = body

  // Validate input
  if (!firstName || !lastName || !phoneNumber) {
    return errorResponse(
      { message: "First name, last name, and phone number are required" },
      400
    )
  }

  try {
    // Check if phone number is already taken by another user
    if (phoneNumber !== user.phoneNumber) {
      const existingUser = await UserModel.findOne({
        phoneNumber: phoneNumber,
        _id: { $ne: user._id },
      })

      if (existingUser) {
        return errorResponse(
          { phoneNumber: "Phone number already in use" },
          400
        )
      }
    }

    // Update user
    const updatedUser = await UserModel.findByIdAndUpdate(
      user._id,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
      },
      { returnDocument: 'after' }
    )

    return successResponse({
      message: "Profile updated successfully",
      user: {
        id: String(updatedUser._id),
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phoneNumber: updatedUser.phoneNumber,
      },
    })
  } catch (error) {
    console.error("Error updating profile:", error)
    return errorResponse({ message: "Failed to update profile" }, 500)
  }
}
