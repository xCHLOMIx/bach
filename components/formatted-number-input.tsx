"use client"

import * as React from "react"

import { Input } from "@/components/ui/input"

type FormattedNumberInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange"> & {
    value: string
    onValueChange: (value: string) => void
}

function stripCommas(value: string) {
    return value.replace(/,/g, "")
}

function formatDecimalWithCommas(value: string) {
    if (!value) {
        return ""
    }

    const [integerPart, decimalPart] = value.split(".")
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

    if (decimalPart !== undefined) {
        return `${formattedInteger}.${decimalPart}`
    }

    return formattedInteger
}

function sanitizeDecimalInput(value: string) {
    const digitsAndDotsOnly = stripCommas(value).replace(/[^\d.]/g, "")
    const firstDotIndex = digitsAndDotsOnly.indexOf(".")

    if (firstDotIndex === -1) {
        return formatDecimalWithCommas(digitsAndDotsOnly)
    }

    const beforeDot = digitsAndDotsOnly.slice(0, firstDotIndex + 1)
    const afterDot = digitsAndDotsOnly.slice(firstDotIndex + 1).replace(/\./g, "")

    return formatDecimalWithCommas(`${beforeDot}${afterDot}`)
}

function countNumericCharacters(value: string) {
    return value.replace(/[^\d.]/g, "").length
}

function getCaretIndexFromNumericOffset(value: string, numericOffset: number) {
    if (numericOffset <= 0) {
        return 0
    }

    let seen = 0
    for (let index = 0; index < value.length; index += 1) {
        if (/[0-9.]/.test(value[index])) {
            seen += 1
        }

        if (seen >= numericOffset) {
            return index + 1
        }
    }

    return value.length
}

export function FormattedNumberInput({
    value,
    onValueChange,
    ...props
}: FormattedNumberInputProps) {
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    const pendingCaretRef = React.useRef<number | null>(null)

    React.useLayoutEffect(() => {
        if (pendingCaretRef.current === null || !inputRef.current || document.activeElement !== inputRef.current) {
            return
        }

        inputRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current)
        pendingCaretRef.current = null
    }, [value])

    return (
        <Input
            {...props}
            ref={inputRef}
            value={value}
            onChange={(event) => {
                const selectionStart = event.target.selectionStart ?? event.target.value.length
                const numericOffset = countNumericCharacters(event.target.value.slice(0, selectionStart))
                const nextValue = sanitizeDecimalInput(event.target.value)

                pendingCaretRef.current = getCaretIndexFromNumericOffset(nextValue, numericOffset)
                onValueChange(nextValue)
            }}
        />
    )
}
