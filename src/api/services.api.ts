import { callApi } from "@/api/client"
import type { Service } from "@/types"

export type ServiceInput = {
  name: string
}

export function listServices() {
  return callApi<Service[]>("/services")
}

export function createService(input: ServiceInput) {
  return callApi<Service>("/services", {
    method: "POST",
    body: input,
  })
}

export function updateService(serviceId: string, input: ServiceInput) {
  return callApi<Service>(`/services/${serviceId}`, {
    method: "PUT",
    body: input,
  })
}

export function deleteService(serviceId: string) {
  return callApi<Service>(`/services/${serviceId}`, {
    method: "DELETE",
  })
}
