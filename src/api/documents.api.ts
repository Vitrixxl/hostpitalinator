import { callApi, callApiResponse } from "@/api/client"
import type { MedicalDocument, MedicalDocumentCategory } from "@/types"

export type AddMedicalDocumentInput = Pick<
  MedicalDocument,
  "title" | "category"
> &
  Partial<
    Pick<MedicalDocument, "storagePath" | "mimeType" | "originalFileName">
  > & {
    contentBase64?: string
  }

export type OpenMedicalDocumentResponse = {
  document: MedicalDocument
  storagePath?: string
}

export function listMedicalDocuments(
  patientId: string,
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
  patientId: string,
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
  return callApiResponse(`/documents/${documentId}/download`)
}
