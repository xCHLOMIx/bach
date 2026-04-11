import { Schema, model, models, type InferSchemaType, Types } from "mongoose"

const productSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    categoryId: { type: Types.ObjectId, ref: "Category", required: false, default: null },
    batchId: { type: Types.ObjectId, ref: "Batch", default: null },
    quantityInitial: { type: Number, required: true, min: 0 },
    quantityRemaining: { type: Number, required: true, min: 0 },
    unitPriceForeign: { type: Number, required: true, min: 0 },
    sourceCurrency: { type: String, required: true, trim: true },
    exchangeRate: { type: Number, required: true, min: 0.000001, default: 1 },
    unitPriceLocalRWF: { type: Number, required: true, min: 0, default: 0 },
    purchasePriceRWF: { type: Number, required: true, min: 0, default: 0 },
    landedCost: { type: Number, required: true, min: 0, default: 0 },
    intendedSellingPrice: { type: Number, required: false, default: null },
    externalLink: { type: String, trim: true, default: "" },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
)

export type ProductDocument = InferSchemaType<typeof productSchema> & {
  _id: string
}

if (models.Product) {
  delete models.Product
}

export const ProductModel = model("Product", productSchema)
