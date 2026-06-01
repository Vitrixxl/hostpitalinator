export type Medicine = {
  id: string
  name: string
  form: string
  administrationRoutes: string
  authorizationStatus: string
  authorizationProcedure: string
  marketingStatus: string
  marketingAuthorizationDate?: string | null
  holder: string
  enhancedSurveillance: string
  activeSubstances: string
  dosageSummary: string
  source: string
  sourceUpdatedAt?: string | null
  createdAt: string
  updatedAt: string
}
