import { NextResponse } from "next/server"

export type FieldErrors = Record<string, string>

export function errorResponse(errors: FieldErrors, status = 400) {
  return NextResponse.json({ errors }, { status })
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
