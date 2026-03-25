"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, User, Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface User {
    id: string
    firstName: string
    lastName: string
    phoneNumber: string
}

export default function AccountPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [user, setUser] = useState<User | null>(null)
    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "profile")

    // Profile editing
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [profileData, setProfileData] = useState({
        firstName: "",
        lastName: "",
        phoneNumber: "",
    })
    const [profileError, setProfileError] = useState("")
    const [profileSuccess, setProfileSuccess] = useState("")
    const [isSubmittingProfile, setIsSubmittingProfile] = useState(false)

    // Password changing
    const [passwordData, setPasswordData] = useState({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
    })
    const [passwordError, setPasswordError] = useState("")
    const [passwordSuccess, setPasswordSuccess] = useState("")
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)
    const [showPasswords, setShowPasswords] = useState(false)

    // Load user data
    useEffect(() => {
        const loadUser = async () => {
            try {
                const response = await fetch("/api/auth/me")
                if (!response.ok) {
                    router.push("/signin")
                    return
                }
                const data = await response.json()
                setUser(data.user)
                setProfileData({
                    firstName: data.user.firstName,
                    lastName: data.user.lastName,
                    phoneNumber: data.user.phoneNumber,
                })
            } catch (error) {
                console.error("Failed to load user:", error)
                router.push("/signin")
            } finally {
                setIsLoadingUser(false)
            }
        }

        loadUser()
    }, [router])

    // Update active tab based on search params
    useEffect(() => {
        const tab = searchParams.get("tab")
        if (tab) {
            setActiveTab(tab)
        }
    }, [searchParams])

    const handleProfileChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { id, value } = e.target
        setProfileData((prev) => ({
            ...prev,
            [id]: value,
        }))
    }

    const handleProfileSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setProfileError("")
        setProfileSuccess("")
        setIsSubmittingProfile(true)

        try {
            const response = await fetch("/api/auth/profile/update", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(profileData),
            })

            const data = await response.json()

            if (!response.ok) {
                setProfileError(
                    data.message ||
                    Object.values(data).find((v) => typeof v === "string") ||
                    "Failed to update profile"
                )
                return
            }

            setUser(data.user)
            setProfileSuccess("Profile updated successfully!")
            setIsEditingProfile(false)

            // Clear success message after 3 seconds
            setTimeout(() => setProfileSuccess(""), 3000)
        } catch (error) {
            setProfileError("An error occurred while updating your profile")
            console.error(error)
        } finally {
            setIsSubmittingProfile(false)
        }
    }

    const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target
        setPasswordData((prev) => ({
            ...prev,
            [id]: value,
        }))
    }

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setPasswordError("")
        setPasswordSuccess("")
        setIsSubmittingPassword(true)

        try {
            const response = await fetch("/api/auth/profile/password", {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(passwordData),
            })

            const data = await response.json()

            if (!response.ok) {
                setPasswordError(
                    data.message ||
                    Object.values(data).find((v) => typeof v === "string") ||
                    "Failed to change password"
                )
                return
            }

            setPasswordSuccess("Password changed successfully!")
            setPasswordData({
                currentPassword: "",
                newPassword: "",
                confirmPassword: "",
            })

            // Clear success message after 3 seconds
            setTimeout(() => setPasswordSuccess(""), 3000)
        } catch (error) {
            setPasswordError("An error occurred while changing your password")
            console.error(error)
        } finally {
            setIsSubmittingPassword(false)
        }
    }

    if (isLoadingUser) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    if (!user) {
        return <div>Failed to load account</div>
    }

    return (
        <div className="container max-w-3xl p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Account</h1>
                <p className="mt text-sm text-slate-600 dark:text-slate-400">Manage your personal information and account security</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-max grid-cols-2">
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="size-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <Lock className="size-4" />
                        Security
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile">
                    <div className="p-0 mt-4">
                        <CardHeader>
                            <CardTitle>Your Profile</CardTitle>
                            <CardDescription>View and manage your personal information</CardDescription>
                        </CardHeader>
                        <CardContent className="mt-4 ml-4">
                            {profileSuccess && (
                                <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {profileSuccess}
                                </div>
                            )}
                            {profileError && (
                                <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
                                    {profileError}
                                </div>
                            )}

                            {isEditingProfile ? (
                                <form onSubmit={handleProfileSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="firstName">First Name</Label>
                                        <Input
                                            id="firstName"
                                            value={profileData.firstName}
                                            onChange={handleProfileChange}
                                            placeholder="Enter first name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="lastName">Last Name</Label>
                                        <Input
                                            id="lastName"
                                            value={profileData.lastName}
                                            onChange={handleProfileChange}
                                            placeholder="Enter last name"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="phoneNumber">Phone Number</Label>
                                        <Input
                                            id="phoneNumber"
                                            value={profileData.phoneNumber}
                                            onChange={handleProfileChange}
                                            placeholder="Enter phone number"
                                        />
                                    </div>

                                    <div className="flex gap-2 pt-4">
                                        <Button
                                            type="submit"
                                            disabled={isSubmittingProfile}
                                            className="gap-2"
                                        >
                                            {isSubmittingProfile && (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            )}
                                            Save Changes
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditingProfile(false)
                                                setProfileData({
                                                    firstName: user.firstName,
                                                    lastName: user.lastName,
                                                    phoneNumber: user.phoneNumber,
                                                })
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">First Name</p>
                                            <p className="text-base font-medium">{user.firstName}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-muted-foreground">Last Name</p>
                                            <p className="text-base font-medium">{user.lastName}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <p className="text-sm font-medium text-muted-foreground">Phone Number</p>
                                        <p className="text-base font-medium">{user.phoneNumber}</p>
                                    </div>

                                    <Button onClick={() => setIsEditingProfile(true)} className="mt-4">
                                        Edit Profile
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </div>
                </TabsContent>

                {/* Settings Tab */}
                <TabsContent value="settings">
                    <div className="p-0 mt-4">
                        <CardHeader>
                            <CardTitle>Password</CardTitle>
                            <CardDescription>Change your account password</CardDescription>
                        </CardHeader>
                        <CardContent className="mt-4 ml-4">
                            {passwordSuccess && (
                                <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm text-green-800 dark:bg-green-900 dark:text-green-200">
                                    {passwordSuccess}
                                </div>
                            )}
                            {passwordError && (
                                <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900 dark:text-red-200">
                                    {passwordError}
                                </div>
                            )}

                            <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="currentPassword">Current Password</Label>
                                    <Input
                                        id="currentPassword"
                                        type={showPasswords ? "text" : "password"}
                                        value={passwordData.currentPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter current password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="newPassword">New Password</Label>
                                    <Input
                                        id="newPassword"
                                        type={showPasswords ? "text" : "password"}
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Enter new password"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                    <Input
                                        id="confirmPassword"
                                        type={showPasswords ? "text" : "password"}
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="Confirm new password"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="showPasswords"
                                        checked={showPasswords}
                                        onChange={(e) => setShowPasswords(e.target.checked)}
                                        className="rounded border border-slate-300"
                                    />
                                    <Label htmlFor="showPasswords" className="text-sm">
                                        Show passwords
                                    </Label>
                                </div>

                                <div className="pt-4">
                                    <Button
                                        type="submit"
                                        disabled={isSubmittingPassword}
                                        className="gap-2"
                                    >
                                        {isSubmittingPassword && (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        )}
                                        Change Password
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
