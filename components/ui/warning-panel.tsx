"use client"

import * as React from "react"
import { TriangleAlertIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type WarningPanelProps = {
    title?: React.ReactNode
    children: React.ReactNode
    className?: string
}

export function WarningPanel({ title = "Warning", children, className }: WarningPanelProps) {
    return (
        <div className={cn("rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30", className)}>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
                <TriangleAlertIcon className="size-4" />
                <span>{title}</span>
            </div>
            <div className="text-sm text-amber-800 dark:text-amber-300">{children}</div>
        </div>
    )
}