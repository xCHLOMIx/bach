import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuthPayload } from "@/lib/server-auth";

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const payload = await getServerAuthPayload();
    const cookieStore = await cookies();
    const sidebarStateCookie = cookieStore.get("sidebar_state")?.value;
    const sidebarDefaultOpen = sidebarStateCookie === "true";

    if (!payload?.userId) {
        redirect("/signin");
    }

    return (
        <SidebarProvider
            defaultOpen={sidebarDefaultOpen}
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
        >
            <AppSidebar variant="inset" />
            <SidebarInset>
                <SiteHeader />
                <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
