import {
  callApi,
  callApiResponse,
  getApiAuthToken,
  getApiBaseUrl,
} from "@/api/client"
import type {
  MedicalDocument,
  MedicalDocumentCategory,
  PatientIdentifier,
} from "@/types"

export type AddMedicalDocumentInput = Pick<
  MedicalDocument,
  "title" | "category"
> &
  Partial<
    Pick<
      MedicalDocument,
      "note" | "storagePath" | "mimeType" | "originalFileName"
    >
  > & {
    contentBase64?: string
  }

export type OpenMedicalDocumentResponse = {
  document: MedicalDocument
  storagePath?: string
}

export function listMedicalDocuments(
  patientId: PatientIdentifier,
  options: { category?: MedicalDocumentCategory } = {}
) {
  const params = new URLSearchParams()

  if (options.category) {
    params.set("category", options.category)
  }

  const query = params.toString()
  return callApi<MedicalDocument[]>(
    `/patients/${patientId}/documents${query ? `?${query}` : ""}`
  )
}

export function addMedicalDocument(
  patientId: PatientIdentifier,
  input: AddMedicalDocumentInput
) {
  return callApi<MedicalDocument>(`/patients/${patientId}/documents`, {
    method: "POST",
    body: input,
  })
}

export function openMedicalDocument(documentId: string) {
  return callApi<OpenMedicalDocumentResponse>(`/documents/${documentId}/open`)
}

export function downloadMedicalDocument(documentId: string) {
  return callApiResponse(getMedicalDocumentDownloadPath(documentId), {
    cache: "no-store",
  })
}

export async function downloadMedicalDocumentBlob(documentId: string) {
  try {
    const response = await downloadMedicalDocument(documentId)

    if (!response.ok) {
      throw new Error(`Chargement refuse (${response.status})`)
    }

    return await response.blob()
  } catch (error) {
    if (!isFetchNetworkError(error)) {
      throw error
    }

    return downloadMedicalDocumentBlobWithXhr(documentId)
  }
}

function isFetchNetworkError(error: unknown) {
  return (
    error instanceof TypeError &&
    /failed to fetch|networkerror|load failed/i.test(error.message)
  )
}

function downloadMedicalDocumentBlobWithXhr(documentId: string) {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const apiBaseUrl = getApiBaseUrl()
    const token = getApiAuthToken()

    xhr.open("GET", `${apiBaseUrl}${getMedicalDocumentDownloadPath(documentId)}`)
    xhr.responseType = "blob"

    if (token) {
      xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response)
        return
      }

      reject(new Error(`Chargement refuse (${xhr.status})`))
    }

    xhr.onerror = () => {
      reject(new Error("Telechargement du document impossible"))
    }

    xhr.onabort = () => {
      reject(new Error("Telechargement du document interrompu"))
    }

    xhr.send()
  })
}

function getMedicalDocumentDownloadPath(documentId: string) {
  const cacheBust = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`

  return `/documents/${documentId}/download?cacheBust=${cacheBust}`
}
