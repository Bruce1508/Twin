import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  AuthenticationRequiredError,
  resolveUserIdentity,
  type UserIdentity,
} from "@/lib/user-identity";

export type AuthenticatedUser = UserIdentity;

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  const sessionUser = session?.user
    ? {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
    }
    : null;

  let developmentUser: UserIdentity | null = null;
  if (process.env.NODE_ENV === "development" && process.env.DEV_USER_ID) {
    developmentUser = await db.user.findUnique({
      where: { id: process.env.DEV_USER_ID },
      select: { id: true, email: true, name: true },
    });
  }

  try {
    return resolveUserIdentity({
      sessionUser,
      developmentUser,
      environment: process.env.NODE_ENV,
    });
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationRequiredError();
  return user;
}
