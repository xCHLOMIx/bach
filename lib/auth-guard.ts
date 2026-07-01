import { NextRequest } from "next/server"

import { verifyAuthToken, getTokenFromRequest } from "@/lib/auth"
import { UserModel } from "@/models/User"
import { BusinessMemberModel } from "@/models/BusinessMember"

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
  if (!user) return null

  const member = await BusinessMemberModel.findOne({ userId: user._id }).lean()
  const workspaceId = member ? member.ownerId : user._id

  return { ...user, workspaceId } as typeof user & { workspaceId: any }
}
