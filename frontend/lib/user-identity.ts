export type UserIdentity = {
  id: string;
  email: string;
  name: string | null;
};

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export function resolveUserIdentity({
  sessionUser,
  developmentUser,
  environment,
}: {
  sessionUser: UserIdentity | null;
  developmentUser: UserIdentity | null;
  environment: string | undefined;
}): UserIdentity {
  if (sessionUser) return sessionUser;
  if (environment === "development" && developmentUser) return developmentUser;
  throw new AuthenticationRequiredError();
}
