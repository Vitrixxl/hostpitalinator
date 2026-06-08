import { callApi } from "@/api/client";
import type { Account, UserRole } from "@/types";

export type GeneratedAccountCredentials = {
  account: Account;
  generatedPassword: string;
};

export type CreateAccountInput = {
  name: string;
  email: string;
  role: UserRole;
  service: string;
  invite?: boolean;
};

export type UpdateAccountInput = Partial<
  Pick<Account, "name" | "email" | "role" | "service">
>;

export function listAccounts(options: { includeDisabled?: boolean } = {}) {
  const params = new URLSearchParams();

  if (options.includeDisabled) {
    params.set("includeDisabled", "true");
  }

  const query = params.toString();
  return callApi<Account[]>(`/accounts${query ? `?${query}` : ""}`);
}

export function getAccount(accountId: number) {
  return callApi<Account>(`/accounts/${accountId}`);
}

export function createAccount(input: CreateAccountInput) {
  return callApi<GeneratedAccountCredentials>("/accounts", {
    method: "POST",
    body: input,
  });
}

export function updateAccount(accountId: number, input: UpdateAccountInput) {
  return callApi<Account>(`/accounts/${accountId}`, {
    method: "PUT",
    body: input,
  });
}

export function disableAccount(accountId: number) {
  return callApi<Account>(`/accounts/${accountId}/disable`, {
    method: "PATCH",
  });
}

export function assignRole(accountId: number, role: UserRole) {
  return callApi<Account>(`/accounts/${accountId}/role`, {
    method: "PATCH",
    body: { role },
  });
}

export function resetAccountPassword(accountId: number) {
  return callApi<GeneratedAccountCredentials>(
    `/accounts/${accountId}/password/reset`,
    {
      method: "PATCH",
    },
  );
}
