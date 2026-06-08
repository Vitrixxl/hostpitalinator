export type UserRole = "admin" | "doctor" | "nurse" | "secretary";

export type Account = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  service: string;
  status: "active" | "invited" | "disabled";
  createdAt?: string;
  updatedAt?: string;
  disabledAt?: string | null;
};
