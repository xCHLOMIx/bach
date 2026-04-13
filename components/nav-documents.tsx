"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { Boxes } from "lucide-react"

export function NavDocuments({
  items,
  isLoading,
}: {
  items?: {
    name: string
    url: string
  }[]
  isLoading?: boolean
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Recent batches</SidebarGroupLabel>
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
        ) : (items || []).length > 0 ? (
          (items || []).map((item) => (
            <SidebarMenuItem key={item.name} className="mt-1 first:mt-0">
              <SidebarMenuButton asChild>
                <a href={item.url} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-muted-foreground">
                    <Boxes className="h-4 w-4" />
                  </div>
                  <span className="truncate">{item.name}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        ) : (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <p>No batches yet</p>
          </div>
        )}
      </SidebarMenu>
    </SidebarGroup>
  )
}
