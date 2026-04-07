export function normalizeAppPath(pathname: string) {
  if (!pathname) {
    return "/"
  }

  const trimmed = pathname.trim().replace(/\/+$/, "")
  return trimmed || "/"
}

export function isAppNavItemActive(pathname: string, itemUrl: string) {
  const currentPath = normalizeAppPath(pathname)
  const targetPath = normalizeAppPath(itemUrl)

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`)
}

export function getAppHeaderTitle(pathname: string) {
  const currentPath = normalizeAppPath(pathname)

  if (currentPath === "/app" || currentPath === "/app/dashboard") {
    return "Dashboard"
  }

  if (currentPath.startsWith("/app/products/")) {
    return "Product details"
  }

  if (currentPath === "/app/products") {
    return "Products"
  }

  if (currentPath.startsWith("/app/batches/")) {
    return "Batch details"
  }

  if (currentPath === "/app/batches") {
    return "Batches"
  }

  if (currentPath === "/app/categories") {
    return "Categories"
  }

  if (currentPath === "/app/sales") {
    return "Sales"
  }

  if (currentPath === "/app/account") {
    return "Account"
  }

  if (currentPath === "/app/test") {
    return "Test"
  }

  const lastSegment = currentPath.split("/").filter(Boolean).at(-1) ?? "Dashboard"
  return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1)
}