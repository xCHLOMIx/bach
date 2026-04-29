"use client"

import * as React from "react"

import { FormattedNumberInput } from "@/components/formatted-number-input"

type CurrencyAmountRateRowProps = {
    amountId: string
    amountLabel: string
    amountPlaceholder?: string
    amountValue: string
    onAmountChange: (value: string) => void
    amountError?: string
    currencyLabel?: string
    currencyValue: string
    onCurrencyChange: (value: string) => void
    currencyOptions: readonly string[]
    rateLabel?: string
    rateValue: string
    onRateChange: (value: string) => void
    ratePlaceholder?: string
    rateError?: string
    disabledRate?: boolean
}

export function CurrencyAmountRateRow({
    amountId,
    amountLabel,
    amountPlaceholder,
    amountValue,
    onAmountChange,
    amountError,
    currencyLabel = "Currency",
    currencyValue,
    onCurrencyChange,
    currencyOptions,
    rateLabel = "Exchange rate",
    rateValue,
    onRateChange,
    ratePlaceholder,
    rateError,
    disabledRate = false,
}: CurrencyAmountRateRowProps) {
    return (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="grid gap-1.5">
                <label htmlFor={amountId} className="text-sm font-medium">{amountLabel}</label>
                <div className="flex rounded-lg border border-input bg-background focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                    <FormattedNumberInput
                        id={amountId}
                        type="text"
                        inputMode="decimal"
                        value={amountValue}
                        onValueChange={onAmountChange}
                        placeholder={amountPlaceholder}
                        className="h-11 rounded-r-none border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0"
                    />
                    <div className="flex items-center rounded-r-lg border-l border-input bg-muted/30 px-2.5">
                        <label className="sr-only" htmlFor={`${amountId}-currency`}>{currencyLabel}</label>
                        <select
                            id={`${amountId}-currency`}
                            value={currencyValue}
                            onChange={(event) => onCurrencyChange(event.target.value)}
                            className="h-9 min-w-20 bg-transparent text-sm outline-none"
                        >
                            {currencyOptions.map((currency) => (
                                <option key={`${amountId}-${currency}`} value={currency}>{currency}</option>
                            ))}
                        </select>
                    </div>
                </div>
                {amountError ? <p className="text-xs text-destructive">{amountError}</p> : null}
            </div>

            <div className="grid gap-1.5">
                <label htmlFor={`${amountId}-rate`} className="text-sm font-medium">{rateLabel}</label>
                <FormattedNumberInput
                    id={`${amountId}-rate`}
                    type="text"
                    inputMode="decimal"
                    disabled={disabledRate}
                    value={rateValue}
                    onValueChange={onRateChange}
                    placeholder={ratePlaceholder}
                    className="h-11"
                />
                {rateError ? <p className="text-xs text-destructive">{rateError}</p> : null}
            </div>
        </div>
    )
}
