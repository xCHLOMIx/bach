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

  const [products, categories, batches, statsData, latestSales, totalSalesCount] = await Promise.all([
    ProductModel.countDocuments({ userId: user._id }),
    CategoryModel.countDocuments({ userId: user._id }),
    BatchModel.countDocuments({ userId: user._id }),
    // Use aggregation pipeline to calculate stats on database
    SaleModel.aggregate([
      { $match: { userId: user._id } },
      {
        $group: {
          _id: null,
          totalProfit: { $sum: { $multiply: ["$profit", "$quantity"] } },
          currentPeriodProfit: {
            $sum: {
              $cond: [
                { $gte: ["$soldAt", currentPeriodStart] },
                { $multiply: ["$profit", "$quantity"] },
                0,
              ],
            },
          },
          previousPeriodProfit: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$soldAt", previousPeriodStart] },
                    { $lt: ["$soldAt", currentPeriodStart] },
                  ],
                },
                { $multiply: ["$profit", "$quantity"] },
                0,
              ],
            },
          },
        },
      },
    ]),
    SaleModel.find({ userId: user._id }).populate("productId", "name").sort({ soldAt: -1 }).limit(8).lean(),
    SaleModel.countDocuments({ userId: user._id }),
  ])

  const { totalProfit = 0, currentPeriodProfit = 0, previousPeriodProfit = 0 } = statsData[0] || {}

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
      sales: totalSalesCount,
      totalProfit,
      profitChangePercent,
      profitTrend,
      totalStock: totalStock[0]?.total ?? 0,
    },
    latestSales,
  })
}
