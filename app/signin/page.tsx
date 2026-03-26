import { LoginForm } from "@/components/login-form"
import { getServerAuthPayload } from "@/lib/server-auth"
import { redirect } from "next/navigation"

export default async function LoginPage() {
  const payload = await getServerAuthPayload()
  if (payload?.userId) {
    redirect("/app/dashboard")
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
