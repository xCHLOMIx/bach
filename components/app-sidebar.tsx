"use client"

import * as React from "react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Box, Boxes, ChartBarIcon, CommandIcon, LayoutDashboardIcon, ListIcon } from "lucide-react"

type ProductApiItem = {
  _id: string
  name: string
  images?: string[]
}

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/app/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Products",
      url: "/app/products",
      icon: <Box />,
    },
    {
      title: "Categories",
      url: "/app/categories",
      icon: <ListIcon />,
    },
    {
      title: "Batches",
      url: "/app/batches",
      icon: <Boxes />,
    },
    {
      title: "Sales",
      url: "/app/sales",
      icon: <ChartBarIcon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [recentProducts, setRecentProducts] = React.useState<ProductApiItem[]>([])
  const [isLoadingRecentProducts, setIsLoadingRecentProducts] = React.useState(true)

  React.useEffect(() => {
    let active = true

    const loadRecentProducts = async () => {
      try {
        const response = await fetch("/api/products")
        if (!response.ok || !active) return

        const json = await response.json()
        if (!active) return

        const products = (json.products ?? []) as ProductApiItem[]
        setRecentProducts(products)
      } finally {
        if (active) {
          setIsLoadingRecentProducts(false)
        }
      }
    }

    loadRecentProducts()

    return () => {
      active = false
    }
  }, [])

  const visibleRecentProducts = recentProducts.slice(0, 3).map((product) => ({
    name: product.name,
    url: `/app/products?productId=${product._id}`,
    image: product.images?.[0] ?? "",
  }))

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <a href="#">
                <CommandIcon className="size-5!" />
                <span className="text-base font-semibold">Bach Inc.</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavDocuments
          items={visibleRecentProducts}
          isLoading={isLoadingRecentProducts}
          hasMore={recentProducts.length > 3}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
