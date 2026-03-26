import { NextRequest } from "next/server"
import bcrypt from "bcryptjs"

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
  const { currentPassword, newPassword, confirmPassword } = body

  // Validate input
  if (!currentPassword || !newPassword || !confirmPassword) {
    return errorResponse(
      { message: "All password fields are required" },
      400
    )
  }

  if (newPassword !== confirmPassword) {
    return errorResponse({ message: "New passwords do not match" }, 400)
  }

  if (newPassword.length < 6) {
    return errorResponse(
      { message: "Password must be at least 6 characters" },
      400
    )
  }

  try {
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isPasswordValid) {
      return errorResponse({ currentPassword: "Current password is incorrect" }, 400)
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update password
    await UserModel.findByIdAndUpdate(user._id, {
      password: hashedPassword,
    })

    return successResponse({
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Error changing password:", error)
    return errorResponse({ message: "Failed to change password" }, 500)
  }
}
