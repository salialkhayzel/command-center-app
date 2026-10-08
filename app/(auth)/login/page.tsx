"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { motion } from "motion/react"
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  Timer,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"

const FEATURES = [
  {
    icon: Activity,
    title: "Real-time monitoring",
    text: "Live discharge queue and stage updates pushed every 10 seconds",
  },
  {
    icon: Timer,
    title: "Turnaround analytics",
    text: "Doctor approval, nursing, ancillary, pharmacy and billing TAT",
  },
  {
    icon: BarChart3,
    title: "Executive insights",
    text: "Trends, bottlenecks and delays at a single glance",
  },
]

export default function LoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, isLoading } = useAuth()
  const [employeeNumber, setEmployeeNumber] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/overview")
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-wmmc" />
      </div>
    )
  }

  if (isAuthenticated) {
    return null
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setLoading(true)
    const result = await login(employeeNumber, password)
    setLoading(false)
    if (result.success) {
      router.replace("/overview")
    } else {
      setError(result.error || "Login failed")
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="bg-grid absolute inset-0 opacity-60" />
      <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full bg-wmmc-light/40 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-[30rem] w-[30rem] rounded-full bg-wmmc/15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative z-10 grid w-full max-w-md overflow-hidden rounded-2xl border bg-card shadow-2xl lg:max-w-5xl lg:grid-cols-[1.1fr_1fr]"
      >
        <div className="relative hidden flex-col justify-between bg-wmmc p-10 text-white lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(154,219,255,0.45),transparent_55%)]" />
          <div className="bg-grid absolute inset-0 opacity-10" />
          <div className="relative space-y-8">
            <div>
              <Image
                src="/login-logo.png"
                alt="West Metro Medical Center"
                width={1725}
                height={417}
                className="w-60 object-contain"
              />
              <p className="mt-3 text-xs text-wmmc-light/70">MPH · mywmportal</p>
            </div>

            <div className="space-y-3">
              <h1 className="text-balance text-3xl font-bold leading-tight">
                Discharge Command Center
              </h1>
              <p className="max-w-sm text-sm leading-relaxed text-white/80">
                Real-time visibility into every stage of the inpatient discharge process for the
                Management Committee.
              </p>
            </div>

            <ul className="space-y-4">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="flex items-start gap-3">
                  <div className="rounded-lg bg-white/10 p-2">
                    <feature.icon className="h-4 w-4 text-wmmc-light" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="text-xs text-wmmc-light/70">{feature.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-wmmc-light/60">
            Information Technology Department · For authorized personnel only
          </p>
        </div>

        <div className="flex flex-col justify-center p-8 sm:p-10">
          <div className="-mx-8 -mt-8 mb-8 bg-wmmc px-8 py-6 sm:-mx-10 sm:-mt-10 sm:mb-10 sm:px-10 lg:hidden">
            <Image
              src="/login-logo.png"
              alt="West Metro Medical Center"
              width={1725}
              height={417}
              className="h-8 w-auto object-contain"
            />
            <p className="mt-4 text-sm font-semibold text-white">Discharge Command Center</p>
            <p className="mt-0.5 text-[11px] text-wmmc-light/80">
              West Metro Medical Center · MPH
            </p>
          </div>

          <div className="mb-8 space-y-2">
            <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Use your mywmportal credentials to continue
            </p>
          </div>

          {error ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="employeeNumber">Employee Number</Label>
              <Input
                id="employeeNumber"
                type="text"
                inputMode="numeric"
                placeholder="e.g., 103321"
                value={employeeNumber}
                onChange={(event) => setEmployeeNumber(event.target.value)}
                required
                className="h-11 focus-visible:ring-wmmc/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="h-11 pr-10 focus-visible:ring-wmmc/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-wmmc text-base text-white hover:bg-wmmc/90"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-8 space-y-2 border-t pt-5 text-center text-xs text-muted-foreground">
            <p>Access is limited to authorized personnel.</p>
            <button
              type="button"
              className="mx-auto flex items-center gap-1 text-wmmc transition-colors hover:underline dark:text-wmmc-light"
              onClick={() => (window.location.href = "mailto:infotech@westmetro.com.ph")}
            >
              <HelpCircle className="h-3 w-3" />
              Contact IT for assistance
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
