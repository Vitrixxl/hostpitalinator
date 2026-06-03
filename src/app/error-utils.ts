import { ApiRequestError } from "@/api/client"

export function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.code === "unauthorized") {
      return "Identifiants invalides ou session expiree"
    }

    return localizeErrorText(error.message, error.code)
  }

  if (error instanceof Error) {
    return localizeErrorText(error.message)
  }

  return "Operation impossible"
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
      return "Cette action entre en conflit avec les donnees existantes"
    case "forbidden":
      return "Vous n'avez pas les droits necessaires"
    case "not_found":
      return "Ressource introuvable"
    case "internal_error":
      return "Erreur interne du serveur"
    default:
      return "Operation impossible"
  }
}

const ENGLISH_ERROR_MESSAGES: Record<string, string> = {
  "Account is disabled": "Ce compte est suspendu",
  "Admin role required": "Role administrateur requis",
  "Authentication required": "Authentification requise",
  "Failed to fetch": "Serveur Hospitalinator indisponible",
  "Internal server error": "Erreur interne du serveur",
  "Invalid credentials": "Identifiants invalides",
  "Resource not found": "Ressource introuvable",
  "Service scope required": "Acces limite au service autorise",
  "Unable to fetch address suggestions": "Suggestions d'adresse indisponibles",
}

function looksLikeEnglishError(message: string) {
  return /\b(account|already|authentication|credentials|error|failed|forbidden|invalid|missing|must|network|not found|required|request|resource|server|timeout|unable|unauthorized|unsupported)\b/i.test(
    message
  )
}
