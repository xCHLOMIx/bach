"use client"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { isAppNavItemActive } from "@/lib/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Box, CirclePlusIcon, MailIcon } from "lucide-react"

export function NavMain({
  items,
  isPinned = false,
}: {
  items: {
    title: string
    url: string
    icon?: React.ReactNode
  }[]
  isPinned?: boolean
}) {
  const pathname = usePathname()
  const { setOpen, setOpenMobile } = useSidebar()
  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-2">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-2">
            <SidebarMenuButton
              asChild
              tooltip="Add product"
              className="min-w-8 bg-secondary text-primary-foreground duration-300 transition ease-linear hover:bg-secondary/85 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
            >
              <Link
                href="/app/products?addProduct=1"
                onClick={() => {
                  if (!isPinned) {
                    setOpen(false)
                    setOpenMobile(false)
                  }
                }}
              >
                <CirclePlusIcon
                />
                <span>Add product</span>
              </Link>
            </SidebarMenuButton>
            <Button
              size="icon"
              className="size-8 group-data-[collapsible=icon]:opacity-0"
              variant="outline"
            >
              <Box
              />
              <span className="sr-only">Inbox</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = isAppNavItemActive(pathname, item.url)
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  className={isActive ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground" : ""}
                >
                  <Link
                    href={item.url}
                    onClick={() => {
                      if (!isPinned) {
                        setOpen(false)
                        setOpenMobile(false)
                      }
                    }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup >
  )
}
