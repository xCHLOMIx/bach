import { Schema, model, models, type InferSchemaType, Types } from "mongoose"

const businessMemberSchema = new Schema(
  {
    ownerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
)

businessMemberSchema.index({ ownerId: 1, userId: 1 }, { unique: true })

export type BusinessMemberDocument = InferSchemaType<typeof businessMemberSchema> & {
  _id: string
}

export const BusinessMemberModel = models.BusinessMember || model("BusinessMember", businessMemberSchema)
