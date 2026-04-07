import { Schema, model, models, type InferSchemaType, Types } from "mongoose"

const batchSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    batchName: { type: String, required: true, trim: true },
    trackingId: { type: String, trim: true, default: "" },
    pickupMethod: { type: String, enum: ["easy", "advanced"], default: "advanced" },
    intlShipping: { type: Number, required: true, min: 0, default: 0 },
    intlShippingCurrency: { type: String, trim: true, default: "RWF" },
    intlShippingExchangeRate: { type: Number, required: true, min: 0, default: 1 },
    taxValue: { type: Number, required: true, min: 0, default: 0 },
    collectionFee: { type: Number, required: true, min: 0, default: 0 },
    customsDuties: { type: Number, required: true, min: 0, default: 0 },
    declaration: { type: Number, required: true, min: 0, default: 0 },
    arrivalNotif: { type: Number, required: true, min: 0, default: 0 },
    warehouseStorage: { type: Number, required: true, min: 0, default: 0 },
    localTransport: { type: Number, required: true, min: 0, default: 0 },
    amazonPrime: { type: Number, required: true, min: 0, default: 0 },
    amazonPrimeCurrency: { type: String, trim: true, default: "RWF" },
    amazonPrimeExchangeRate: { type: Number, required: true, min: 0, default: 1 },
    warehouseUSA: { type: Number, required: true, min: 0, default: 0 },
    warehouseUSACurrency: { type: String, trim: true, default: "RWF" },
    warehouseUSAExchangeRate: { type: Number, required: true, min: 0, default: 1 },
    miscellaneous: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true }
)

export type BatchDocument = InferSchemaType<typeof batchSchema> & { _id: string }

const existingBatchModel = models.Batch

if (existingBatchModel?.schema?.path("exchangeRate")) {
  delete models.Batch
}

export const BatchModel = models.Batch || model("Batch", batchSchema)
