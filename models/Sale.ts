import { Schema, model, models, type InferSchemaType, Types } from "mongoose"

const saleSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1 },
    sellingPrice: { type: Number, required: true, min: 0 },
    landedCost: { type: Number, required: true, min: 0 },
    profit: { type: Number, required: true },
    soldAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
)

// Index only for userId - simpler indexes are faster
saleSchema.index({ userId: 1, soldAt: -1 })

export type SaleDocument = InferSchemaType<typeof saleSchema> & { _id: string }

export const SaleModel = models.Sale || model("Sale", saleSchema)
