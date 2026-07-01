"use client"

import React, { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Loader2, User, Lock, Users, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { preventImplicitSubmitOnEnter } from "@/lib/form-guard"
import { formatPhoneNumberInput, normalizePhoneNumber } from "@/lib/phone"
import { MemberSheet } from "@/components/member-sheet"
import { createPortal } from "react-dom"

interface User {
    id: string
    firstName: string
    lastName: string
    phoneNumber: string
    isOwner: boolean
}

export default function AccountPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [user, setUser] = useState<User | null>(null)
    const [isLoadingUser, setIsLoadingUser] = useState(true)
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") ?? "profile")

    interface Member {
        _id: string
        userId: {
            _id: string
            firstName: string
            lastName: string
            phoneNumber: string
            createdAt: string
        }
    }
    const [members, setMembers] = useState<Member[]>([])
    const [isLoadingMembers, setIsLoadingMembers] = useState(false)
    const [hasLoadedMembers, setHasLoadedMembers] = useState(false)
    const [memberToDelete, setMemberToDelete] = useState<string | null>(null)
    const [isDeletingMember, setIsDeletingMember] = useState(false)

    const loadMembers = async () => {
        setIsLoadingMembers(true)
        try {
            const response = await fetch("/api/members")
            if (response.ok) {
                const data = await response.json()
                setMembers(data.members || [])
                setHasLoadedMembers(true)
            }
        } catch (error) {
            console.error("Failed to load members:", error)
        } finally {
            setIsLoadingMembers(false)
        }
    }

    useEffect(() => {
        if (activeTab === "members" && !hasLoadedMembers && user) {
            void loadMembers()
        }
    }, [activeTab, hasLoadedMembers, user])

    const confirmDeleteMember = async () => {
        if (!memberToDelete) return
        setIsDeletingMember(true)
        
        try {
            const response = await fetch(`/api/members/${memberToDelete}`, {
                method: "DELETE"
            })
            if (response.ok) {
                toast.success("Member removed successfully")
                void loadMembers()
            } else {
                toast.error("Failed to remove member")
            }
        } catch (error) {
            console.error("Failed to delete member:", error)
            toast.error("An error occurred")
        } finally {
            setIsDeletingMember(false)
            setMemberToDelete(null)
        }
    }

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
                    phoneNumber: formatPhoneNumberInput(data.user.phoneNumber),
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

    // Extract tab value outside effect to avoid object reference changes
    const tabFromParams = searchParams.get("tab")

    // Update active tab based on search params
    useEffect(() => {
        if (tabFromParams) {
            setActiveTab(tabFromParams)
        }
    }, [tabFromParams])

    const handleProfileChange = (
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        const { id, value } = e.target
        setProfileData((prev) => ({
            ...prev,
            [id]: id === "phoneNumber" ? formatPhoneNumberInput(value) : value,
        }))
    }

    const hasProfileChanges = React.useMemo(() => {
        if (!user) {
            return false
        }

        return (
            profileData.firstName.trim() !== user.firstName.trim() ||
            profileData.lastName.trim() !== user.lastName.trim() ||
            normalizePhoneNumber(profileData.phoneNumber) !== normalizePhoneNumber(user.phoneNumber)
        )
    }, [profileData, user])

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
                body: JSON.stringify({
                    ...profileData,
                    phoneNumber: normalizePhoneNumber(profileData.phoneNumber),
                }),
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
            <div className="container p-8">
                <div className="mb-8">
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-4 w-64" />
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-10 w-[300px]" />
                    <Skeleton className="h-[400px] w-full rounded-xl" />
                </div>
            </div>
        )
    }

    if (!user) {
        return <div>Failed to load account</div>
    }

    return (
        <div className="container p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Account</h1>
                <p className="mt text-sm text-muted-foreground">Manage your personal information and account security</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className={user.isOwner ? "grid w-max grid-cols-3" : "grid w-max grid-cols-2"}>
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="size-4" />
                        Profile
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="gap-2">
                        <Lock className="size-4" />
                        Security
                    </TabsTrigger>
                    {user.isOwner && (
                        <TabsTrigger value="members" className="gap-2">
                            <Users className="size-4" />
                            Members
                        </TabsTrigger>
                    )}
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
                                <div className="mb-4 rounded-lg bg-accent/30 p-4 text-sm text-accent-foreground">
                                    {profileSuccess}
                                </div>
                            )}
                            {profileError && (
                                <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                                    {profileError}
                                </div>
                            )}

                            {isEditingProfile ? (
                                <form onSubmit={handleProfileSubmit} onKeyDown={preventImplicitSubmitOnEnter} className="space-y-4">
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
                                            disabled={isSubmittingProfile || !hasProfileChanges}
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
                                                    phoneNumber: formatPhoneNumberInput(user.phoneNumber),
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
                                <div className="mb-4 rounded-lg bg-accent/30 p-4 text-sm text-accent-foreground">
                                    {passwordSuccess}
                                </div>
                            )}
                            {passwordError && (
                                <div className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                                    {passwordError}
                                </div>
                            )}

                            <form onSubmit={handlePasswordSubmit} onKeyDown={preventImplicitSubmitOnEnter} className="space-y-4">
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
                                    <Checkbox
                                        id="showPasswords"
                                        checked={showPasswords}
                                        onCheckedChange={(checked) => setShowPasswords(Boolean(checked))}
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

                {/* Members Tab */}
                {user.isOwner && (
                    <TabsContent value="members">
                        <div className="mt-4">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Members</CardTitle>
                                    <CardDescription>Manage members belonging to your business</CardDescription>
                                </div>
                                <MemberSheet onMemberAdded={() => loadMembers()} />
                            </CardHeader>
                            <CardContent className="mt-4">
                                <div className="rounded-md border max-w-full overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Phone Number</TableHead>
                                                <TableHead>Date Added</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoadingMembers ? (
                                                Array.from({ length: 3 }).map((_, i) => (
                                                    <TableRow key={`member-loading-${i}`}>
                                                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                                        <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                                                    </TableRow>
                                                ))
                                            ) : members.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="h-48 text-center">
                                                        <Empty>
                                                            <EmptyHeader>
                                                                <EmptyTitle>No members found</EmptyTitle>
                                                                <EmptyDescription>
                                                                    Get started by adding a new member to your business.
                                                                </EmptyDescription>
                                                            </EmptyHeader>
                                                        </Empty>
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                members.map((member) => (
                                                    <TableRow key={member._id}>
                                                        <TableCell className="font-medium">
                                                            {member.userId.firstName} {member.userId.lastName}
                                                        </TableCell>
                                                        <TableCell>{member.userId.phoneNumber}</TableCell>
                                                        <TableCell>
                                                            {new Date(member.userId.createdAt).toLocaleDateString(undefined, {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                            })}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                <MemberSheet member={member} onMemberAdded={() => loadMembers()} />
                                                                <Button variant="ghost" size="icon" onClick={() => setMemberToDelete(member._id)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </div>
                    </TabsContent>
                )}
            </Tabs>

            {memberToDelete && createPortal(
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-in fade-in duration-200" onClick={() => setMemberToDelete(null)}>
                    <div className="bg-card rounded-lg shadow-lg p-6 max-w-sm mx-4 border border-border animate-in zoom-in-95 slide-in-from-bottom-2 duration-200" onClick={(event) => event.stopPropagation()}>
                        <h2 className="text-lg font-semibold text-foreground mb-2">
                            Remove Member?
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Are you sure you want to remove this member from your business? They will lose access to all products and sales.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setMemberToDelete(null)}
                                disabled={isDeletingMember}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={confirmDeleteMember}
                                disabled={isDeletingMember}
                            >
                                {isDeletingMember ? "Removing..." : "Remove"}
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
