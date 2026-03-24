import { Schema, model, models, type InferSchemaType } from "mongoose"

const batchSchema = new Schema(
  {
    batchName: { type: String, required: true, trim: true },
    intlShipping: { type: Number, required: true, min: 0, default: 0 },
    taxValue: { type: Number, required: true, min: 0, default: 0 },
    customsDuties: { type: Number, required: true, min: 0, default: 0 },
    declaration: { type: Number, required: true, min: 0, default: 0 },
    arrivalNotif: { type: Number, required: true, min: 0, default: 0 },
    warehouseStorage: { type: Number, required: true, min: 0, default: 0 },
    amazonPrime: { type: Number, required: true, min: 0, default: 0 },
    warehouseUSA: { type: Number, required: true, min: 0, default: 0 },
    miscellaneous: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
)

export type BatchDocument = InferSchemaType<typeof batchSchema> & { _id: string }

export const BatchModel = models.Batch || model("Batch", batchSchema)
