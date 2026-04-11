import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format RWF amount (no decimals - RWF is whole currency)
 */
export function formatRWF(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-"
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0, minimumFractionDigits: 0 })
}

/**
 * Format foreign currency or exchange rate (with decimals)
 */
export function formatCurrency(value: number | undefined, decimals = 2): string {
  if (value === undefined || Number.isNaN(value)) {
    return "-"
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}
