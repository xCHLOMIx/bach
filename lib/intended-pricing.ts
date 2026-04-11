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



export function getIntendedSellingPrice(productId: string, products?: ProductWithSellingPrice[]): number | undefined {
  const pricesMap = getAllIntendedSellingPrices(products)
  return pricesMap[productId]
}
