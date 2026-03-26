import type { Metadata } from "next"

import { LandingPage } from "@/components/landing-page"
import { getServerAuthPayload } from "@/lib/server-auth"
import { connectToDatabase } from "@/lib/db"
import { UserModel } from "@/models/User"

export const metadata: Metadata = {
  title: "Bach",
  description:
    "Track imported products, landed costs, shipment batches, inventory, and sales from one clean workspace.",
}

export default async function HomePage() {
  const payload = await getServerAuthPayload()

  if (!payload?.userId) {
    return <LandingPage />
  }

  await connectToDatabase()
  const user = await UserModel.findById(payload.userId).lean()

  const displayName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : ""
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

  return <LandingPage authUser={displayName ? { name: displayName, initials } : undefined} />
}
