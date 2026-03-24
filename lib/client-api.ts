export type ApiError = {
  errors?: Record<string, string>
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    const errorData = data as ApiError
    throw errorData
  }

  return data as T
}
