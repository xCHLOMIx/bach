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

  const [products, categories, batches, sales, latestSales] = await Promise.all([
    ProductModel.countDocuments(),
    CategoryModel.countDocuments(),
    BatchModel.countDocuments(),
    SaleModel.find().lean(),
    SaleModel.find().populate("productId", "name").sort({ soldAt: -1 }).limit(8).lean(),
  ])

  const totalProfit = sales.reduce((sum, sale) => sum + sale.profit * sale.quantity, 0)
  const totalStock = await ProductModel.aggregate<{ total: number }>([
    { $group: { _id: null, total: { $sum: "$quantityRemaining" } } },
  ])

  return successResponse({
    stats: {
      products,
      categories,
      batches,
      sales: sales.length,
      totalProfit,
      totalStock: totalStock[0]?.total ?? 0,
    },
    latestSales,
  })
}
