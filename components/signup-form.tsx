"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  FieldError,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import Image from "next/image"
import { formatPhoneNumberInput, normalizePhoneNumber } from "@/lib/phone"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const router = useRouter()
  const [firstName, setFirstName] = React.useState("")
  const [lastName, setLastName] = React.useState("")
  const [phoneNumber, setPhoneNumber] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = React.useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrors({})
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          phoneNumber: normalizePhoneNumber(phoneNumber),
          password,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        setErrors(data.errors ?? { general: "Unable to create account" })
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
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 text-center">
                <Image
                  src="/logos/logo_no_bg.svg"
                  alt="Bach"
                  width={28}
                  height={28}
                  className="size-7"
                  priority
                />
                <h1 className="text-2xl font-bold">Create your account</h1>
                <p className="text-sm text-balance text-muted-foreground">
                  Use your phone number and password to create your account
                </p>
              </div>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="first-name">First name</FieldLabel>
                  <FieldError className="text-destructive text-xs">
                    {errors.firstName}
                  </FieldError>
                </div>
                <Input
                  id="first-name"
                  type="text"
                  placeholder="John"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                />
              </Field>
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel htmlFor="last-name">Last name</FieldLabel>
                  <FieldError className="text-destructive text-xs">
                    {errors.lastName}
                  </FieldError>
                </div>
                <Input
                  id="last-name"
                  type="text"
                  placeholder="Doe"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                />
              </Field>
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
                  onChange={(event) => setPhoneNumber(formatPhoneNumberInput(event.target.value))}
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
                  placeholder="••••••••••"
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
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </Field>
              <FieldDescription className="text-center">
                Already have an account? <Link href="/signin">Sign in</Link>
              </FieldDescription>
            </FieldGroup>
          </form>
          <div className="relative hidden items-center w-ful justify-center bg-primary/20 md:flex">
          </div>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
