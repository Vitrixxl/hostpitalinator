export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN =
  /^(?:(?:\+|00)33[\s.-]?[1-9](?:[\s.-]?\d{2}){4}|0[1-9](?:[\s.-]?\d{2}){4})$/;

export const REQUIRED_FIELD_MESSAGE = "Ce champ est obligatoire.";
export const EMAIL_FORMAT_MESSAGE = "Saisissez une adresse courriel valide.";
export const PHONE_FORMAT_MESSAGE =
  "Saisissez un numéro de téléphone valide.";

export function validateRequired(value: unknown) {
  if (typeof value === "string") {
    return value.trim().length > 0 || REQUIRED_FIELD_MESSAGE;
  }

  return value ? true : REQUIRED_FIELD_MESSAGE;
}

export function validateOptionalEmail(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return true;
  }

  return EMAIL_PATTERN.test(trimmed) || EMAIL_FORMAT_MESSAGE;
}

export function validateRequiredEmail(value: string | null | undefined) {
  const requiredResult = validateRequired(value);

  if (requiredResult !== true) {
    return requiredResult;
  }

  return validateOptionalEmail(value);
}

export function validateOptionalPhone(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return true;
  }

  return PHONE_PATTERN.test(trimmed) || PHONE_FORMAT_MESSAGE;
}

export function validateRequiredPhone(value: string | null | undefined) {
  const requiredResult = validateRequired(value);

  if (requiredResult !== true) {
    return requiredResult;
  }

  return validateOptionalPhone(value);
}
