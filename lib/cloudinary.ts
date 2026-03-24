import { v2 as cloudinary } from "cloudinary"

const cloudName = process.env.CLOUDINARY_CLOUD_NAME
const apiKey = process.env.CLOUDINARY_API_KEY
const apiSecret = process.env.CLOUDINARY_API_SECRET

function configureCloudinary() {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are missing")
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  })
}

export async function uploadImageFile(file: File) {
  configureCloudinary()

  const arrayBuffer = await file.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const mime = file.type || "image/jpeg"
  const dataUri = `data:${mime};base64,${base64}`

  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "bach/products",
    resource_type: "image",
  })

  return result.secure_url
}
