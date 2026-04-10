const INTENDED_SELLING_PRICES_KEY = "products:intended-selling-prices"

type IntendedSellingPrices = Record<string, number>

export function getAllIntendedSellingPrices(): IntendedSellingPrices {
  if (typeof window === "undefined") {
    return {}
  }

  const raw = window.localStorage.getItem(INTENDED_SELLING_PRICES_KEY)
  if (!raw) {
    return {}
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const normalized: IntendedSellingPrices = {}

    for (const [productId, value] of Object.entries(parsed)) {
      const numericValue = Number(value)
      if (Number.isFinite(numericValue) && numericValue >= 0) {
        normalized[productId] = numericValue
      }
    }

    return normalized
  } catch {
    return {}
  }
}

export function setIntendedSellingPrice(productId: string, value: number | null | undefined) {
  if (typeof window === "undefined" || !productId) {
    return
  }

  const next = getAllIntendedSellingPrices()

  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    delete next[productId]
  } else {
    next[productId] = value
  }

  window.localStorage.setItem(INTENDED_SELLING_PRICES_KEY, JSON.stringify(next))
}

export function getIntendedSellingPrice(productId: string): number | undefined {
  return getAllIntendedSellingPrices()[productId]
}
