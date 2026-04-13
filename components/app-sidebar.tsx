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
import { Box, Boxes, ChartBarIcon, LayoutDashboardIcon, ListIcon, PinIcon, PinOffIcon } from "lucide-react"
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
  const [isPinned, setIsPinned] = React.useState(false)
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isMobile, setOpenMobile, setOpen } = useSidebar()
  const sidebarRef = React.useRef<HTMLDivElement>(null)

  // Load pin state from localStorage on mount
  React.useEffect(() => {
    const savedPinned = localStorage.getItem('sidebar-pinned')
    if (savedPinned !== null) {
      setIsPinned(JSON.parse(savedPinned))
    }
    setHasMounted(true)
  }, [])

  // Persist pin state to localStorage
  React.useEffect(() => {
    if (hasMounted) {
      localStorage.setItem('sidebar-pinned', JSON.stringify(isPinned))
    }
  }, [isPinned, hasMounted])

  React.useEffect(() => {
    if (!hasMounted) {
      return
    }

    if (isPinned) {
      setOpen(true)
    }
  }, [hasMounted, isPinned, setOpen])

  // Close sidebar when clicking outside if unpinned
  React.useEffect(() => {
    if (isPinned) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (sidebarRef.current && !sidebarRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isPinned, setOpen])

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
  const handlePin = () => {
    const nextPinned = !isPinned
    setIsPinned(nextPinned)

    if (nextPinned) {
      setOpen(true)
    }

    if (nextPinned && isMobile) {
      setOpenMobile(true)
    }
  }

  return (
    <Sidebar collapsible="offcanvas" ref={sidebarRef} {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center justify-between gap-2 p-1.5">
              <div className="flex items-center gap-2">
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
              <button
                onClick={handlePin}
                className={`h-8 w-8 rounded-md transition-colors flex items-center justify-center ${isPinned
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
              >
                {isPinned ? (
                  <PinIcon className="h-4 w-4" />
                ) : (
                  <PinOffIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} isPinned={isPinned} />
        <NavDocuments
          items={visibleRecentProducts}
          isLoading={isLoadingRecentProducts}
        />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar >
  )
}
