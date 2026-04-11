const INTENDED_SELLING_PRICES_KEY = "products:intended-selling-prices"

type IntendedSellingPrices = Record<string, number>

type ProductWithSellingPrice = {
  _id: string
  intendedSellingPrice?: number | null
}

export function getAllIntendedSellingPrices(products?: ProductWithSellingPrice[]): IntendedSellingPrices {
  // Build from product data (now stored in database)
  if (!products || products.length === 0) {
    return {}
  }

  const prices: IntendedSellingPrices = {}
  for (const product of products) {
    if (product.intendedSellingPrice && Number.isFinite(product.intendedSellingPrice)) {
      prices[product._id] = product.intendedSellingPrice
    }
  }

  return prices
}

export function setIntendedSellingPrice(productId: string, value: number | null | undefined) {
  if (!productId) {
    return
  }

  // Save to database only - no localStorage
  fetch("/api/products", {
    method: "PATCH",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      productId,
      intendedSellingPrice: String(value ?? ""),
    }).toString(),
  }).catch(() => {
    // Silent fail - just don't save
  })
}

export function getIntendedSellingPrice(productId: string): number | undefined {
  return getAllIntendedSellingPrices()[productId]
}
