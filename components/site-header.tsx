"use client"

import { usePathname } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {
  const pathname = usePathname()
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "dashboard"
  const title = segment.charAt(0).toUpperCase() + segment.slice(1)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full min-w-0 items-center gap-2 px-4 lg:gap-3 lg:px-6">
        <div className="border-r pr-2 mr-2 flex h-full items-center md:hidden">
          <SidebarTrigger className="-ml-1" />
        </div>
        <h1 className="min-w-0 truncate text-base font-medium md:text-lg">{title}</h1>
      </div>
    </header>
  )
}
