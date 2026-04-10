"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { PlusIcon } from "lucide-react"

const SOURCE_CURRENCY_OPTIONS = ["USD", "RWF", "CNY", "AED"] as const

type AddProductSheetProps = {
    onProductCreated?: () => Promise<void> | void
}

export function AddProductSheet({ onProductCreated }: AddProductSheetProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [isSubmitting, setIsSubmitting] = React.useState(false)
    const [errors, setErrors] = React.useState<Record<string, string>>({})

    const [name, setName] = React.useState("")
    const [quantityInitial, setQuantityInitial] = React.useState("")
    const [unitPriceForeign, setUnitPriceForeign] = React.useState("")
    const [sourceCurrency, setSourceCurrency] = React.useState<(typeof SOURCE_CURRENCY_OPTIONS)[number]>("USD")
    const [exchangeRate, setExchangeRate] = React.useState("")
    const [externalLink, setExternalLink] = React.useState("")

    const toIntegerInput = (value: string) => value.replace(/\D/g, "")
    const stripCommas = (value: string) => value.replace(/,/g, "")

    const formatDecimalWithCommas = (value: string) => {
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

    const toDecimalInput = (value: string) => {
        const digitsAndDotsOnly = stripCommas(value).replace(/[^\d.]/g, "")
        const firstDotIndex = digitsAndDotsOnly.indexOf(".")

        if (firstDotIndex === -1) {
            return formatDecimalWithCommas(digitsAndDotsOnly)
        }

        const beforeDot = digitsAndDotsOnly.slice(0, firstDotIndex + 1)
        const afterDot = digitsAndDotsOnly.slice(firstDotIndex + 1).replace(/\./g, "")

        return formatDecimalWithCommas(`${beforeDot}${afterDot}`)
    }

    const resetForm = () => {
        setName("")
        setQuantityInitial("")
        setUnitPriceForeign("")
        setSourceCurrency("USD")
        setExchangeRate("")
        setExternalLink("")
        setErrors({})
    }

    const submit = async () => {
        if (isSubmitting) {
            return
        }

        setIsSubmitting(true)
        setErrors({})

        try {
            const formData = new FormData()
            formData.append("name", name)
            formData.append("quantityInitial", quantityInitial)
            formData.append("unitPriceForeign", stripCommas(unitPriceForeign))
            formData.append("sourceCurrency", sourceCurrency)
            formData.append("exchangeRate", stripCommas(exchangeRate))
            formData.append("externalLink", externalLink)

            const response = await fetch("/api/products", {
                method: "POST",
                body: formData,
            })

            const data = await response.json()
            if (!response.ok) {
                setErrors(data.errors ?? { general: "Failed to create product" })
                return
            }

            resetForm()
            setIsOpen(false)
            await onProductCreated?.()
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Sheet
            open={isOpen}
            onOpenChange={(open) => {
                setIsOpen(open)
                if (!open) {
                    resetForm()
                }
            }}
        >
            <SheetTrigger asChild>
                <Button type="button" size="sm" variant="outline">
                    <PlusIcon className="h-4 w-4" />
                    Add Product
                </Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Add Product</SheetTitle>
                    <SheetDescription>Create a product without leaving this page.</SheetDescription>
                </SheetHeader>

                <div className="grid gap-4 p-4">
                    <div className="grid gap-1.5">
                        <label htmlFor="quick-product-name" className="text-sm font-medium">Product name</label>
                        <Input
                            id="quick-product-name"
                            placeholder="Product name"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                        />
                        {errors.name ? <FieldError className="text-destructive text-xs">{errors.name}</FieldError> : null}
                    </div>

                    <div className="grid gap-1.5">
                        <label htmlFor="quick-product-quantity" className="text-sm font-medium">Initial stock</label>
                        <Input
                            id="quick-product-quantity"
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter initial stock"
                            value={quantityInitial}
                            onChange={(event) => setQuantityInitial(toIntegerInput(event.target.value))}
                        />
                        {errors.quantityInitial ? <FieldError className="text-destructive text-xs">{errors.quantityInitial}</FieldError> : null}
                    </div>

                    <div className="grid gap-1.5">
                        <label htmlFor="quick-product-unit-price" className="text-sm font-medium">Unit price</label>
                        <Input
                            id="quick-product-unit-price"
                            type="text"
                            inputMode="decimal"
                            placeholder="Enter unit price"
                            value={unitPriceForeign}
                            onChange={(event) => setUnitPriceForeign(toDecimalInput(event.target.value))}
                        />
                        {errors.unitPriceForeign ? <FieldError className="text-destructive text-xs">{errors.unitPriceForeign}</FieldError> : null}
                    </div>

                    <div className="grid gap-1.5">
                        <label htmlFor="quick-product-currency" className="text-sm font-medium">Source currency</label>
                        <Select value={sourceCurrency} onValueChange={(value) => setSourceCurrency(value as (typeof SOURCE_CURRENCY_OPTIONS)[number])}>
                            <SelectTrigger id="quick-product-currency">
                                <SelectValue placeholder="Choose source currency" />
                            </SelectTrigger>
                            <SelectContent>
                                {SOURCE_CURRENCY_OPTIONS.map((currency) => (
                                    <SelectItem key={currency} value={currency}>
                                        {currency}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {errors.sourceCurrency ? <FieldError className="text-destructive text-xs">{errors.sourceCurrency}</FieldError> : null}
                    </div>

                    <div className="grid gap-1.5">
                        <label htmlFor="quick-product-exchange-rate" className="text-sm font-medium">Exchange rate to RWF</label>
                        <Input
                            id="quick-product-exchange-rate"
                            type="text"
                            inputMode="decimal"
                            placeholder={sourceCurrency === "RWF" ? "Auto-set to 1 for RWF" : "Enter exchange rate to RWF"}
                            value={exchangeRate}
                            disabled={sourceCurrency === "RWF"}
                            onChange={(event) => setExchangeRate(toDecimalInput(event.target.value))}
                        />
                        {errors.exchangeRate ? <FieldError className="text-destructive text-xs">{errors.exchangeRate}</FieldError> : null}
                    </div>

                    <div className="grid gap-1.5">
                        <label htmlFor="quick-product-link" className="text-sm font-medium">External link (optional)</label>
                        <Input
                            id="quick-product-link"
                            type="url"
                            placeholder="https://example.com/product"
                            value={externalLink}
                            onChange={(event) => setExternalLink(event.target.value)}
                        />
                        {errors.externalLink ? <FieldError className="text-destructive text-xs">{errors.externalLink}</FieldError> : null}
                    </div>

                    {errors.general ? <FieldError className="text-destructive text-xs">{errors.general}</FieldError> : null}

                    <div className="flex items-center justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="button" onClick={() => void submit()} loading={isSubmitting} loadingText="Adding product">
                            Add Product
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}
