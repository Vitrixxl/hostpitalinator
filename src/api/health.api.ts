import { callApi } from "@/api/client"

export function healthCheck() {
  return callApi<{ status: string }>("/health").then((result) => result.status)
}
