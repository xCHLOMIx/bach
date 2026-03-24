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
  customsDuties: number
  declaration: number
  arrivalNotif: number
  warehouseStorage: number
  amazonPrime: number
  warehouseUSA: number
  miscellaneous: number
}

export function calculateBatchProductLandedCosts(
  products: BatchProductInput[],
  costs: BatchCostInputs
): BatchProductCostOutput[] {
  const batchExtraCosts =
    costs.intlShipping +
    costs.taxValue +
    costs.customsDuties +
    costs.declaration +
    costs.arrivalNotif +
    costs.warehouseStorage +
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
