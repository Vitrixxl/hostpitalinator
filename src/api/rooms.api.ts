import { callApi } from "@/api/client"
import type { Room } from "@/types"

export type RoomInput = Pick<Room, "label" | "service"> & {
  sortOrder?: number
}

export function listRooms(options: { service?: string } = {}) {
  const params = new URLSearchParams()

  if (options.service) {
    params.set("service", options.service)
  }

  const query = params.toString()
  return callApi<Room[]>(`/rooms${query ? `?${query}` : ""}`)
}

export function createRoom(input: RoomInput) {
  return callApi<Room>("/rooms", {
    method: "POST",
    body: input,
  })
}

export function updateRoom(roomId: string, input: RoomInput) {
  return callApi<Room>(`/rooms/${roomId}`, {
    method: "PUT",
    body: input,
  })
}

export function deleteRoom(roomId: string) {
  return callApi<Room>(`/rooms/${roomId}`, {
    method: "DELETE",
  })
}
