import { callApi } from "@/api/client"
import type { Medicine } from "@/types"

export function searchMedicines(search: string, limit = 20) {
  const params = new URLSearchParams({
    search,
    limit: limit.toString(),
  })

  return callApi<Medicine[]>(`/medicines?${params.toString()}`)
}
