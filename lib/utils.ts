import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMinutes(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const total = Math.max(0, Math.round(value))
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PH").format(value)
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value)
}

export function fullDateTime(value: string | null | undefined): string {
  if (!value) return "—"
  return value.slice(0, 16)
}

export function localToday(): string {
  return new Date().toLocaleDateString("en-CA")
}

export function shiftDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setDate(parsed.getDate() + days)
  return parsed.toLocaleDateString("en-CA")
}

export function formatTime(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
