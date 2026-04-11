import { NextRequest } from "next/server"

import { connectToDatabase } from "@/lib/db"
import { errorResponse, successResponse } from "@/lib/api"
import { getAuthorizedUser } from "@/lib/auth-guard"
import { ProductModel } from "@/models/Product"
import { SaleModel } from "@/models/Sale"
import { BatchModel } from "@/models/Batch"
import { CategoryModel } from "@/models/Category"

export async function GET(request: NextRequest) {
  await connectToDatabase()

  const user = await getAuthorizedUser(request)
  if (!user) return errorResponse({ auth: "Unauthorized" }, 401)

  // Calculate date range for profit trend analysis
  const now = new Date()
  const DAYS_WINDOW = 7
  const currentPeriodStart = new Date(now)
  currentPeriodStart.setDate(now.getDate() - DAYS_WINDOW)
  const previousPeriodStart = new Date(currentPeriodStart)
  previousPeriodStart.setDate(currentPeriodStart.getDate() - DAYS_WINDOW)

  // Fast simple queries instead of complex aggregation
  const [products, categories, batches, sales, latestSales] = await Promise.all([
    ProductModel.countDocuments({ userId: user._id }),
    CategoryModel.countDocuments({ userId: user._id }),
    BatchModel.countDocuments({ userId: user._id }),
    SaleModel.find({ userId: user._id }).select("profit quantity soldAt").lean(),
    SaleModel.find({ userId: user._id }).populate("productId", "name").sort({ soldAt: -1 }).limit(8).lean(),
  ])

  // Calculate stats in memory (faster for small-medium datasets)
  const totalProfit = sales.reduce((sum, sale) => sum + (sale.profit * sale.quantity), 0)

  const currentPeriodProfit = sales.reduce((sum, sale) => {
    if (new Date(sale.soldAt) >= currentPeriodStart) {
      return sum + (sale.profit * sale.quantity)
    }
    return sum
  }, 0)

  const previousPeriodProfit = sales.reduce((sum, sale) => {
    const saleDate = new Date(sale.soldAt)
    if (saleDate >= previousPeriodStart && saleDate < currentPeriodStart) {
      return sum + (sale.profit * sale.quantity)
    }
    return sum
  }, 0)

  let profitChangePercent = 0
  if (previousPeriodProfit === 0) {
    profitChangePercent = currentPeriodProfit === 0 ? 0 : 100
  } else {
    profitChangePercent = ((currentPeriodProfit - previousPeriodProfit) / Math.abs(previousPeriodProfit)) * 100
  }

  const profitTrend: "up" | "down" | "stable" =
    profitChangePercent > 0 ? "up" : profitChangePercent < 0 ? "down" : "stable"

  const totalStock = await ProductModel.aggregate<{ total: number }>([
    { $match: { userId: user._id } },
    { $group: { _id: null, total: { $sum: "$quantityRemaining" } } },
  ])

  return successResponse({
    stats: {
      products,
      categories,
      batches,
      sales: sales.length,
      totalProfit,
      profitChangePercent,
      profitTrend,
      totalStock: totalStock[0]?.total ?? 0,
    },
    latestSales,
  })
}
