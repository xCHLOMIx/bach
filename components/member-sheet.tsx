"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ProductSheetFrame } from "@/components/product-sheet-frame"
import { formatPhoneNumberInput, normalizePhoneNumber } from "@/lib/phone"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"

type Member = {
    _id: string
    userId: {
        _id: string
        firstName: string
        lastName: string
        phoneNumber: string
    }
}

type MemberSheetProps = {
    member?: Member
    onMemberAdded?: () => Promise<void> | void
}

export function MemberSheet({ member, onMemberAdded }: MemberSheetProps) {
    const [open, setOpen] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [errors, setErrors] = React.useState<Record<string, string>>({})

    const [firstName, setFirstName] = React.useState(member?.userId.firstName ?? "")
    const [lastName, setLastName] = React.useState(member?.userId.lastName ?? "")
    const [phoneNumber, setPhoneNumber] = React.useState(member?.userId.phoneNumber ? formatPhoneNumberInput(member.userId.phoneNumber) : "")
    const [password, setPassword] = React.useState("")

    React.useEffect(() => {
        if (member) {
            setFirstName(member.userId.firstName)
            setLastName(member.userId.lastName)
            setPhoneNumber(formatPhoneNumberInput(member.userId.phoneNumber))
        } else {
            resetForm()
        }
    }, [member])

    const resetForm = () => {
        setFirstName("")
        setLastName("")
        setPhoneNumber("")
        setPassword("")
        setErrors({})
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            // Reset form a moment after closing to avoid jarring visual changes
            setTimeout(resetForm, 300)
        }
    }

    const canSubmit =
        Boolean(firstName.trim()) &&
        Boolean(lastName.trim()) &&
        Boolean(phoneNumber.trim()) &&
        (member ? true : Boolean(password.trim()))

    const submit = async () => {
        if (isSubmitting) {
            return
        }

        setIsSubmitting(true)
        setErrors({})

        try {
            const url = member ? `/api/members/${member._id}` : "/api/members"
            const method = member ? "PATCH" : "POST"
            const response = await fetch(url, {
                method,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    firstName,
                    lastName,
                    phoneNumber,
                    password,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                setErrors(data.errors || data)
                toast.error(data.message || data.general || data.phoneNumber || (member ? "Failed to update member" : "Failed to add member"))
                return
            }

            toast.success(member ? "Member updated successfully" : "Member added successfully")
            setOpen(false)
            resetForm()
            await onMemberAdded?.()
        } catch (error) {
            console.error("Failed to save member:", error)
            toast.error("An error occurred while saving the member")
        } finally {
            setIsSubmitting(false)
        }
    }

    const isEditing = !!member

    return (
        <ProductSheetFrame
            open={open}
            onOpenChange={handleOpenChange}
            title={isEditing ? "Edit Member" : "Add Member"}
            description={isEditing ? "Update member details." : "Add a new member to your business workspace."}
            contentClassName="p-0"
            triggerButton={
                member ? (
                    <Button type="button" variant="outline" size="sm">
                        Edit
                    </Button>
                ) : (
                    <Button type="button" size="lg" className="gap-2">
                        <PlusIcon className="h-4 w-4" />
                        Add Member
                    </Button>
                )
            }
        >
            {open ? (
                <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto grid gap-6 px-6">
                        <form id="add-member-form" onSubmit={(e) => { e.preventDefault(); void submit(); }} onKeyDown={preventImplicitSubmitOnEnter} className="space-y-4">
                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel htmlFor="firstName">First Name</FieldLabel>
                                    <FieldError className="text-xs text-destructive">{errors.firstName}</FieldError>
                                </div>
                                <Input
                                    id="firstName"
                                    placeholder="Enter first name"
                                    value={firstName}
                                    onChange={(event) => setFirstName(event.target.value)}
                                />
                            </Field>

                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel htmlFor="lastName">Last Name</FieldLabel>
                                    <FieldError className="text-xs text-destructive">{errors.lastName}</FieldError>
                                </div>
                                <Input
                                    id="lastName"
                                    placeholder="Enter last name"
                                    value={lastName}
                                    onChange={(event) => setLastName(event.target.value)}
                                />
                            </Field>

                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel htmlFor="phoneNumber">Phone Number</FieldLabel>
                                    <FieldError className="text-xs text-destructive">{errors.phoneNumber}</FieldError>
                                </div>
                                <Input
                                    id="phoneNumber"
                                    placeholder="Enter phone number"
                                    value={phoneNumber}
                                    onChange={(event) => setPhoneNumber(formatPhoneNumberInput(event.target.value))}
                                />
                            </Field>

                            <Field>
                                <div className="flex items-center justify-between">
                                    <FieldLabel htmlFor="password">New Password</FieldLabel>
                                    <FieldError className="text-xs text-destructive">{errors.password}</FieldError>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder={isEditing ? "Leave blank to keep current" : "Set an initial password"}
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                />
                            </Field>
                            {errors.general ? <FieldError className="text-xs text-destructive mt-2">{errors.general}</FieldError> : null}
                            <button type="submit" className="hidden" />
                        </form>
                    </div>

                    <div className="sticky bottom-0 left-0 right-0 z-20 backdrop-blur-sm border-t border-border p-4 flex items-center justify-end gap-2 bg-background/80">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setOpen(false)
                            }}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            disabled={!canSubmit || isSubmitting}
                            onClick={() => void submit()}
                            className="gap-2"
                        >
                            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                            {isSubmitting ? "Saving..." : (isEditing ? "Save Changes" : "Add Member")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </ProductSheetFrame>
    )
}
