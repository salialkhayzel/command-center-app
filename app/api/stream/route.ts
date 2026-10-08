import { subscribe } from "@/lib/live-store"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("retry: 5000\n\n"))
      unsubscribe = subscribe((chunk) => {
        try {
          controller.enqueue(chunk)
        } catch {
          unsubscribe?.()
        }
      })
      request.signal.addEventListener("abort", () => {
        unsubscribe?.()
        try {
          controller.close()
        } catch {}
      })
    },
    cancel() {
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
