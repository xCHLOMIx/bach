"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  FieldError,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { GalleryVerticalEndIcon } from "lucide-react"
import Link from "next/link"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoading(true)
    setErrors({})

    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password }),
      })

      const data = await response.json()
      if (!response.ok) {
        setErrors(data.errors ?? { general: "Unable to sign in" })
        return
      }

      router.push("/app/dashboard")
      router.refresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
              <span className="sr-only">Bach Inc.</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to Bach Inc.</h1>
            <FieldDescription>
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </FieldDescription>
          </div>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="phone-number">Phone number</FieldLabel>
              <FieldError className="text-destructive text-xs">
                {errors.phoneNumber}
              </FieldError>
            </div>
            <Input
              id="phone-number"
              type="tel"
              placeholder="0788 888 888"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <FieldError className="text-destructive text-xs">
                {errors.password}
              </FieldError>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FieldDescription>
              Must be at least 8 characters long.
            </FieldDescription>
          </Field>
          {errors.general ? (
            <FieldError className="text-destructive text-xs">{errors.general}</FieldError>
          ) : null}
          <Field>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Login"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
