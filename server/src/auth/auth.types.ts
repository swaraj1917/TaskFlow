import { Role } from "@prisma/client";

export type AccessTokenPayload = {
  userId: number;
  role: Role;
};