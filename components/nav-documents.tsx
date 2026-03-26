"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import Image from "next/image"
import { MoreHorizontalIcon } from "lucide-react"
import Link from "next/link"

export function NavDocuments({
  items,
  isLoading,
  hasMore,
}: {
  items?: {
    name: string
    url: string
    image?: string
  }[]
  isLoading?: boolean
  hasMore?: boolean
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent products</SidebarGroupLabel>
      <SidebarMenu>
        {isLoading ? (
          // Skeleton loading state
          Array.from({ length: 3 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <SidebarMenuButton asChild>
                <div className="flex items-center gap-3 w-full">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-4 w-32 flex-1" />
                </div>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        ) : (
          (items || []).map((item) => (
            <SidebarMenuItem key={item.name} className="mt-1 first:mt-0">
              <SidebarMenuButton asChild>
                <a href={item.url} className="flex items-center gap-3">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      width={32}
                      height={32}
                      className="size-6 rounded object-cover"
                    />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                      {item.name.trim().substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="truncate">{item.name}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        )}
        {hasMore && !isLoading && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/app/products" className="text-sidebar-foreground/70">
                <MoreHorizontalIcon className="text-sidebar-foreground/70" />
                <span>More</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
