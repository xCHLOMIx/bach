import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) {
    return errorResponse({ auth: "Unauthorized" }, 401)
  }

  return successResponse({
    user: {
      id: String(user._id),
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
    },
  })
}
