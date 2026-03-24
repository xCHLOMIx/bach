import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { NextRequest } from "next/server"

const JWT_SECRET = process.env.JWT_SECRET

function jwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined")
  }

  return JWT_SECRET
}

export const AUTH_COOKIE_NAME = "bach_token"

type TokenPayload = {
  userId: string
}

export function signAuthToken(userId: string) {
  return jwt.sign({ userId }, jwtSecret(), { expiresIn: "7d" })
}

export function verifyAuthToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, jwtSecret()) as TokenPayload
  } catch {
    return null
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies()
  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  })
}

export async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_COOKIE_NAME)
}

export function getTokenFromRequest(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value
}
