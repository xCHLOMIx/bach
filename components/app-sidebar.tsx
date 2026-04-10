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
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Box, Boxes, ChartBarIcon, LayoutDashboardIcon, ListIcon } from "lucide-react"
import Image from "next/image"

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
      title: "Sales",
      url: "/app/sales",
      icon: <ChartBarIcon />,
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
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [recentProducts, setRecentProducts] = React.useState<ProductApiItem[]>([])
  const [isLoadingRecentProducts, setIsLoadingRecentProducts] = React.useState(true)
  const { isMobile, setOpenMobile } = useSidebar()

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
      } catch (error) {
        console.error("Failed to load recent products:", error)
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

  const visibleRecentProducts = recentProducts.slice(0, 4).map((product) => ({
    name: product.name,
    url: `/app/products/${product._id}`,
    image: product.images?.[0] ?? "",
  }))

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-1.5">
              <Image
                src="/logos/logo_black.svg"
                alt="Bach"
                width={22}
                height={22}
                className="size-8"
                priority
              />
              <span className="text-base font-semibold">Bach Inc.</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent
        onClickCapture={(event) => {
          if (!isMobile) {
            return
          }

          const target = event.target
          if (target instanceof Element && target.closest("a[href]")) {
            setOpenMobile(false)
          }
        }}
      >
        <NavMain items={data.navMain} />
        <NavDocuments
          items={visibleRecentProducts}
          isLoading={isLoadingRecentProducts}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
