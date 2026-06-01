export {
  assignRole,
  createAccount,
  disableAccount,
  getAccount,
  listAccounts,
  resetAccountPassword,
  updateAccount,
  type CreateAccountInput,
  type GeneratedAccountCredentials,
  type UpdateAccountInput,
} from "@/api/accounts.api"
export {
  bootstrapAdmin,
  getCurrentAccount,
  login,
  logout,
  type AuthSession,
  type BootstrapAdminResponse,
  type BootstrapAdminInput,
} from "@/api/auth.api"
export {
  createBed,
  deleteBed,
  listBeds,
  updateBed,
  type CreateBedInput,
  type UpdateBedInput,
} from "@/api/beds.api"
export {
  addMedicalDocument,
  downloadMedicalDocument,
  listMedicalDocuments,
  openMedicalDocument,
  type AddMedicalDocumentInput,
  type OpenMedicalDocumentResponse,
} from "@/api/documents.api"
export {
  addEvolutionNote,
  listEvolutionNotes,
  type AddEvolutionNoteInput,
} from "@/api/evolutions.api"
export { healthCheck } from "@/api/health.api"
export {
  searchAddressSuggestions,
  type AddressSuggestion,
} from "@/api/geocoding.api"
export {
  addLabResult,
  listLabResults,
  type AddLabResultInput,
} from "@/api/labs.api"
export { searchMedicines } from "@/api/medicines.api"
export {
  archivePatient,
  createPatient,
  endPatientVisit,
  getPatient,
  listPatients,
  startNewPatientVisit,
  updatePatient,
  type CreatePatientInput,
  type UpdatePatientInput,
} from "@/api/patients.api"
export {
  createService,
  deleteService,
  listServices,
  updateService,
  type ServiceInput,
} from "@/api/services.api"
export {
  addPrescription,
  listPrescriptions,
  updatePrescriptionStatus,
  type AddPrescriptionInput,
} from "@/api/prescriptions.api"
export {
  connectRealtime,
  disconnectRealtime,
  setRealtimeContext,
  subscribeRealtime,
  type RealtimeContext,
  type RealtimeEvent,
  type RealtimeMessage,
} from "@/api/realtime.api"
export {
  addVitalRecord,
  deleteVitalRecord,
  getLatestVitalRecord,
  listVitalRecords,
  updateVitalRecord,
  type VitalRecordInput,
} from "@/api/vitals.api"
