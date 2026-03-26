import { Schema, model, models, type InferSchemaType, Types } from "mongoose"

const categorySchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
)

categorySchema.index({ userId: 1, name: 1 }, { unique: true })

export type CategoryDocument = InferSchemaType<typeof categorySchema> & {
  _id: string
}

export const CategoryModel = models.Category || model("Category", categorySchema)
