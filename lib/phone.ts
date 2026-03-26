export function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "").slice(0, 10)
}

export function formatPhoneNumberInput(value: string) {
  const digits = normalizePhoneNumber(value)
  const part1 = digits.slice(0, 4)
  const part2 = digits.slice(4, 7)
  const part3 = digits.slice(7, 10)

  return [part1, part2, part3].filter(Boolean).join(" ")
}
