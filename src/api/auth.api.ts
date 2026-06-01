import {
  callApi,
  clearApiAuthToken,
  setApiAuthToken,
} from "@/api/client"
import { disconnectRealtime } from "@/api/realtime.api"
import type { Account } from "@/types"

export type AuthSession = {
  token: string
  account: Account
}

export type BootstrapAdminResponse = {
  account: Account
  generatedPassword: string
}

export type BootstrapAdminInput = {
  name: string
  email: string
  service: string
}

export function bootstrapAdmin(input: BootstrapAdminInput) {
  return callApi<BootstrapAdminResponse>("/auth/bootstrap-admin", {
    method: "POST",
    body: input,
    token: "",
  })
}

export async function login(email: string, password: string) {
  const session = await callApi<AuthSession>("/auth/login", {
    method: "POST",
    body: { email, password },
    token: "",
  })

  setApiAuthToken(session.token)
  return session
}

export async function logout() {
  const result = await callApi<{ status: string }>("/auth/logout", {
    method: "POST",
  })

  disconnectRealtime()
  clearApiAuthToken()
  return result
}

export function getCurrentAccount() {
  return callApi<{ account: Account }>("/auth/me")
}
