import { SignupForm } from "@/components/signup-form"
import { getServerAuthPayload } from "@/lib/server-auth"
import { redirect } from "next/navigation"

export default async function SignupPage() {
  const payload = await getServerAuthPayload()
  if (payload?.userId) {
    redirect("/app/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-muted p-6 md:p-10">
      <div className="w-full max-w-sm md:max-w-4xl">
        <SignupForm />
      </div>
    </div>
  )
}
