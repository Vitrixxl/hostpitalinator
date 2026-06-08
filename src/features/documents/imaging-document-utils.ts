import type { MedicalDocument } from "@/types";

export function canOpenDicomViewer(document: MedicalDocument) {
  if (document.category !== "imaging") {
    return false;
  }

  const mimeType = document.mimeType?.toLowerCase() ?? "";
  const fileReference = [
    document.originalFileName,
    document.storagePath,
    document.title,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    mimeType.includes("dicom") ||
    mimeType.includes("zip") ||
    fileReference.includes(".dcm") ||
    fileReference.includes(".dicom") ||
    fileReference.includes(".zip") ||
    fileReference.includes("dicom")
  );
}
