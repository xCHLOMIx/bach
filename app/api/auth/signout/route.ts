import { clearAuthCookie } from "@/lib/auth"
import { successResponse } from "@/lib/api"

export async function POST() {
  await clearAuthCookie()
  return successResponse({ ok: true })
}
