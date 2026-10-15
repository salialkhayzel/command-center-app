"use client"

import { useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
import { ChevronDown, LogOut, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { LiveStatus } from "@/components/live-status"
import { useAuth } from "@/lib/auth-context"
import { LiveMetricsProvider, useLiveMetricsContext } from "@/lib/live-metrics-context"
import { cn, initials } from "@/lib/utils"

const NAV_LINKS = [
  { label: "Overview", href: "/overview" },
  { label: "Stage Performance", href: "/overview#stages" },
  { label: "Trends", href: "/overview#trends" },
  { label: "Doctor Approval", href: "/overview#doctor-approval" },
]

const CLEARANCE_LINKS = [
  { label: "Nursing Clearance", href: "/overview#nursing-clearance" },
  { label: "Ancillary Clearance", href: "/overview#ancillary-clearance" },
  { label: "Pharmacy Clearance", href: "/overview#pharmacy-clearance" },
]

function DashboardHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { snapshot, connected } = useLiveMetricsContext()

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-3">
          <Image
            src="/2022-West-Metro-logo-with-MPH.png"
            alt="West Metro Medical Center"
            width={36}
            height={36}
            className="h-9 w-auto object-contain"
          />
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight">Discharge Command Center</p>
            <p className="text-[11px] text-muted-foreground">West Metro Medical Center · MPH</p>
          </div>
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-foreground",
                pathname === link.href ? "bg-accent font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Clearances
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-50 min-w-[200px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              >
                {CLEARANCE_LINKS.map((link) => (
                  <DropdownMenu.Item key={link.href} asChild>
                    <a
                      href={link.href}
                      className="flex cursor-pointer items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                    >
                      {link.label}
                    </a>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LiveStatus connected={connected} updatedAt={snapshot?.generatedAt} />
          <ThemeToggle />
          <div className="hidden items-center gap-2.5 rounded-full border py-1 pl-1 pr-3 md:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(user?.displayName || "")}
            </span>
            <div className="leading-tight">
              <p className="max-w-[150px] truncate text-xs font-medium">{user?.displayName}</p>
              <p className="max-w-[150px] truncate text-[10px] text-muted-foreground">
                {user?.jobTitle || user?.department}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login")
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <LiveMetricsProvider>
      <div className="min-h-screen bg-muted/30">
        <DashboardHeader />
        <main className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">{children}</main>
      </div>
    </LiveMetricsProvider>
  )
}
