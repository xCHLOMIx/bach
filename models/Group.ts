import { Schema, model, models, type InferSchemaType, Types } from "mongoose"

const groupSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    productIds: [{ type: Types.ObjectId, ref: "Product", required: true }],
    items: [
      {
        productId: { type: Types.ObjectId, ref: "Product", required: true },
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { timestamps: true }
)

groupSchema.index({ userId: 1, name: 1 }, { unique: true })
groupSchema.index({ userId: 1, createdAt: -1 })

export type GroupDocument = InferSchemaType<typeof groupSchema> & {
  _id: string
}

export const GroupModel = models.Group || model("Group", groupSchema)