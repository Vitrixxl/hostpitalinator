import { ApiRequestError } from "@/api/client"

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "unauthorized") {
      return "Identifiants invalides ou session expiree"
    }

    return error.message
  }

  if (error instanceof Error) {
    if (error.message === "Failed to fetch") {
      return "Serveur Hospitalinator indisponible"
    }

    return error.message
  }

  return "Operation impossible"
}
