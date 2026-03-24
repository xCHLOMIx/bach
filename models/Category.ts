import { Schema, model, models, type InferSchemaType } from "mongoose"

const categorySchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  { timestamps: true }
)

export type CategoryDocument = InferSchemaType<typeof categorySchema> & {
  _id: string
}

export const CategoryModel = models.Category || model("Category", categorySchema)
