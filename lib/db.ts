import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI

function mongoUri(): string {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined")
  }

  return MONGODB_URI
}

type MongooseCache = {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var __mongooseCache: MongooseCache | undefined
}

const globalCache = globalThis as typeof globalThis & {
  __mongooseCache?: MongooseCache
}

const cache: MongooseCache = globalCache.__mongooseCache ?? {
  conn: null,
  promise: null,
}

if (!globalCache.__mongooseCache) {
  globalCache.__mongooseCache = cache
}

export async function connectToDatabase() {
  if (cache.conn) {
    return cache.conn
  }

  if (!cache.promise) {
    cache.promise = mongoose.connect(mongoUri(), {
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 45000,
      socketTimeoutMS: 30000,
      serverSelectionTimeoutMS: 5000,
      retryWrites: true,
      directConnection: false,
    })
  }

  cache.conn = await cache.promise
  return cache.conn
}
