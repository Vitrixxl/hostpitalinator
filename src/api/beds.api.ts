import { callApi } from "@/api/client"
import type { Bed } from "@/types"

export type CreateBedInput = Pick<Bed, "label" | "service"> & {
  sortOrder?: number
}

export type UpdateBedInput = Partial<CreateBedInput>

export function listBeds() {
  return callApi<Bed[]>("/beds")
}

export function createBed(input: CreateBedInput) {
  return callApi<Bed>("/beds", {
    method: "POST",
    body: input,
  })
}

export function updateBed(bedId: string, input: UpdateBedInput) {
  return callApi<Bed>(`/beds/${bedId}`, {
    method: "PUT",
    body: input,
  })
}

export function deleteBed(bedId: string) {
  return callApi<Bed>(`/beds/${bedId}`, {
    method: "DELETE",
  })
}
