import { ApiRequestError } from "@/api/client"

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "unauthorized") {
      return "Identifiants invalides ou session expirée"
    }

    return localizeErrorText(error.message, error.code)
  }

  if (error instanceof Error) {
    return localizeErrorText(error.message)
  }

  return "Opération impossible"
}

function localizeErrorText(message: string, code?: string) {
  const normalized = message.trim()

  if (!normalized) {
    return fallbackMessage(code)
  }

  const translated = ENGLISH_ERROR_MESSAGES[normalized]

  if (translated) {
    return translated
  }

  if (looksLikeEnglishError(normalized)) {
    return fallbackMessage(code)
  }

  return normalized
}

function fallbackMessage(code?: string) {
  switch (code) {
    case "bad_request":
      return "La demande est invalide"
    case "conflict":
      return "Cette action entre en conflit avec les données existantes"
    case "forbidden":
      return "Vous n'avez pas les droits nécessaires"
    case "not_found":
      return "Ressource introuvable"
    case "internal_error":
      return "Erreur interne du serveur"
    default:
      return "Opération impossible"
  }
}

const ENGLISH_ERROR_MESSAGES: Record<string, string> = {
  "Account is disabled": "Ce compte est suspendu",
  "Admin role required": "Rôle administrateur requis",
  "Authentication required": "Authentification requise",
  "Failed to fetch": "Serveur du CH de Versailles indisponible",
  "Internal server error": "Erreur interne du serveur",
  "Invalid credentials": "Identifiants invalides",
  "Resource not found": "Ressource introuvable",
  "Service scope required": "Accès limité au service autorisé",
  "Unable to fetch address suggestions": "Suggestions d'adresse indisponibles",
}

function looksLikeEnglishError(message: string) {
  return /\b(account|already|authentication|credentials|error|failed|forbidden|invalid|missing|must|network|not found|required|request|resource|server|timeout|unable|unauthorized|unsupported)\b/i.test(
    message
  )
}
