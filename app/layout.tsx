import type { Metadata } from "next"
import "@fontsource-variable/inter"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "sonner"

export const metadata: Metadata = {
  title: "Discharge Command Center",
  description:
    "Real-time inpatient discharge process monitoring for the Management Committee",
  icons: {
    icon: "/favicon.svg",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider delayDuration={200}>
              {children}
              <Toaster richColors position="top-right" />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
