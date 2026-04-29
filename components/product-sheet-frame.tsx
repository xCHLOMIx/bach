"use client"

import * as React from "react"

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"

type SheetContentProps = React.ComponentProps<typeof SheetContent>

type ProductSheetFrameProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    contentClassName?: string
    side?: SheetContentProps["side"]
    triggerButton?: React.ReactNode
    onInteractOutside?: SheetContentProps["onInteractOutside"]
    onEscapeKeyDown?: SheetContentProps["onEscapeKeyDown"]
}

export function ProductSheetFrame({
    open,
    onOpenChange,
    title,
    description,
    children,
    contentClassName,
    side,
    triggerButton,
    onInteractOutside,
    onEscapeKeyDown,
}: ProductSheetFrameProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            {triggerButton ? <SheetTrigger asChild>{triggerButton}</SheetTrigger> : null}
            <SheetContent
                side={side}
                className={contentClassName}
                onInteractOutside={onInteractOutside}
                onEscapeKeyDown={onEscapeKeyDown}
            >
                <SheetHeader>
                    <SheetTitle className="w-max max-w-10/12 truncate">{title}</SheetTitle>
                    {description ? <SheetDescription>{description}</SheetDescription> : null}
                </SheetHeader>
                {children}
            </SheetContent>
        </Sheet>
    )
}
