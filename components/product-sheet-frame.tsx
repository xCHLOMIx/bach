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

type ProductSheetFrameProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: React.ReactNode
    description?: React.ReactNode
    children: React.ReactNode
    contentClassName?: string
    side?: "left" | "right" | "top" | "bottom"
    triggerButton?: React.ReactNode
    onInteractOutside?: (event: React.PointerEvent<HTMLDivElement> | React.FocusEvent<HTMLDivElement>) => void
    onEscapeKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
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
                    <SheetTitle>{title}</SheetTitle>
                    {description ? <SheetDescription>{description}</SheetDescription> : null}
                </SheetHeader>
                {children}
            </SheetContent>
        </Sheet>
    )
}
