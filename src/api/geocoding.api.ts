const GEOCODING_SEARCH_URL = "https://data.geopf.fr/geocodage/search"
const ADDRESS_SUGGESTION_LIMIT = "6"

export type AddressSuggestion = {
  id: string
  label: string
  name?: string
  postcode?: string
  city?: string
  context?: string
  type?: string
}

type GeocodingSearchResponse = {
  features?: GeocodingFeature[]
}

type GeocodingFeature = {
  properties?: GeocodingProperties
}

type GeocodingProperties = {
  id?: string
  label?: string
  name?: string
  postcode?: string
  city?: string
  context?: string
  type?: string
}

export async function searchAddressSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const normalizedQuery = query.trim()

  if (normalizedQuery.length < 3) {
    return []
  }

  const searchParams = new URLSearchParams({
    q: normalizedQuery,
    index: "address",
    autocomplete: "1",
    limit: ADDRESS_SUGGESTION_LIMIT,
  })

  const response = await fetch(`${GEOCODING_SEARCH_URL}?${searchParams}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error("Suggestions d'adresse indisponibles")
  }

  const payload = (await response.json()) as GeocodingSearchResponse
  const seenLabels = new Set<string>()

  return (payload.features ?? [])
    .map((feature) => addressSuggestionFromFeature(feature))
    .filter((suggestion): suggestion is AddressSuggestion => {
      if (!suggestion || seenLabels.has(suggestion.label)) {
        return false
      }

      seenLabels.add(suggestion.label)
      return true
    })
}

function addressSuggestionFromFeature(
  feature: GeocodingFeature
): AddressSuggestion | null {
  const properties = feature.properties
  const label = properties?.label?.trim()

  if (!label) {
    return null
  }

  return {
    id: properties?.id ?? label,
    label,
    name: properties?.name,
    postcode: properties?.postcode,
    city: properties?.city,
    context: properties?.context,
    type: properties?.type,
  }
}
