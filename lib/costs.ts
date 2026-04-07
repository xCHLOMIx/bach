export type BatchProductInput = {
  productId: string
  quantityInitial: number
  unitPriceLocalRWF: number
}

export type BatchProductCostOutput = {
  productId: string
  quantityInitial: number
  unitPriceLocalRWF: number
  purchasePriceRWF: number
  landedCost: number
}

export type BatchCostInputs = {
  intlShipping: number
  taxValue: number
  collectionFee: number
  customsDuties: number
  declaration: number
  arrivalNotif: number
  warehouseStorage: number
  localTransport: number
  amazonPrime: number
  warehouseUSA: number
  miscellaneous: number
}

type BatchCostSource = {
  intlShipping?: number
  intlShippingCurrency?: string
  intlShippingExchangeRate?: number
  taxValue?: number
  collectionFee?: number
  customsDuties?: number
  declaration?: number
  arrivalNotif?: number
  warehouseStorage?: number
  localTransport?: number
  amazonPrime?: number
  amazonPrimeCurrency?: string
  amazonPrimeExchangeRate?: number
  warehouseUSA?: number
  warehouseUSACurrency?: string
  warehouseUSAExchangeRate?: number
  miscellaneous?: number
}

export function convertInternationalExpenseToRwf(
  amount: number,
  currency: string | undefined,
  exchangeRate: number | undefined
) {
  const safeAmount = Number.isFinite(amount) ? amount : 0
  if ((currency ?? "RWF") === "RWF") {
    return safeAmount
  }

  const rate = Number.isFinite(exchangeRate) && (exchangeRate ?? 0) > 0 ? (exchangeRate as number) : 1
  return safeAmount * rate
}

export function buildBatchCostInputsFromBatch(batch: BatchCostSource): BatchCostInputs {
  return {
    intlShipping: convertInternationalExpenseToRwf(
      Number(batch.intlShipping ?? 0),
      batch.intlShippingCurrency,
      Number(batch.intlShippingExchangeRate ?? 1)
    ),
    taxValue: Number(batch.taxValue ?? 0),
    collectionFee: Number(batch.collectionFee ?? 0),
    customsDuties: Number(batch.customsDuties ?? 0),
    declaration: Number(batch.declaration ?? 0),
    arrivalNotif: Number(batch.arrivalNotif ?? 0),
    warehouseStorage: Number(batch.warehouseStorage ?? 0),
    localTransport: Number(batch.localTransport ?? 0),
    amazonPrime: convertInternationalExpenseToRwf(
      Number(batch.amazonPrime ?? 0),
      batch.amazonPrimeCurrency,
      Number(batch.amazonPrimeExchangeRate ?? 1)
    ),
    warehouseUSA: convertInternationalExpenseToRwf(
      Number(batch.warehouseUSA ?? 0),
      batch.warehouseUSACurrency,
      Number(batch.warehouseUSAExchangeRate ?? 1)
    ),
    miscellaneous: Number(batch.miscellaneous ?? 0),
  }
}

export function calculateBatchProductLandedCosts(
  products: BatchProductInput[],
  costs: BatchCostInputs
): BatchProductCostOutput[] {
  const batchExtraCosts =
    costs.intlShipping +
    costs.taxValue +
    costs.collectionFee +
    costs.customsDuties +
    costs.declaration +
    costs.arrivalNotif +
    costs.warehouseStorage +
    costs.localTransport +
    costs.amazonPrime +
    costs.warehouseUSA +
    costs.miscellaneous

  const perProduct = products.map((product) => {
    const purchasePriceRWF = product.unitPriceLocalRWF
    const purchaseValue = purchasePriceRWF * product.quantityInitial

    return {
      ...product,
      purchasePriceRWF,
      purchaseValue,
    }
  })

  const totalPurchaseValue = perProduct.reduce(
    (sum, product) => sum + product.purchaseValue,
    0
  )

  return perProduct.map((product) => {
    const percentage =
      totalPurchaseValue > 0 ? product.purchaseValue / totalPurchaseValue : 0

    const allocatedCostsTotal = batchExtraCosts * percentage
    const allocatedCostPerUnit =
      product.quantityInitial > 0 ? allocatedCostsTotal / product.quantityInitial : 0

    return {
      productId: product.productId,
      quantityInitial: product.quantityInitial,
      unitPriceLocalRWF: product.unitPriceLocalRWF,
      purchasePriceRWF: product.purchasePriceRWF,
      landedCost: product.purchasePriceRWF + allocatedCostPerUnit,
    }
  })
}
