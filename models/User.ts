import { Schema, model, models, type InferSchemaType } from "mongoose"

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true }
)

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: string }

export const UserModel = models.User || model("User", userSchema)
