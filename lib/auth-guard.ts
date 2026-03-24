import { NextRequest } from "next/server"

import { verifyAuthToken, getTokenFromRequest } from "@/lib/auth"
import { UserModel } from "@/models/User"

export async function getAuthorizedUser(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) {
    return null
  }

  const payload = verifyAuthToken(token)
  if (!payload?.userId) {
    return null
  }

  const user = await UserModel.findById(payload.userId).lean()
  return user
}
