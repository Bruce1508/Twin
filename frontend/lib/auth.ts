import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";
const localBaseURL = process.env.NODE_ENV === "development" ? "http://localhost:3000" : undefined;
const requiredProductionVariables = {
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  GOOGLE_CLIENT_ID: googleClientId,
  GOOGLE_CLIENT_SECRET: googleClientSecret,
};

if (process.env.NODE_ENV === "production" && !isProductionBuild) {
  const missing = Object.entries(requiredProductionVariables)
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing production authentication variables: ${missing.join(", ")}`);
  }
}

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  baseURL:
    process.env.BETTER_AUTH_URL ??
    localBaseURL ??
    (isProductionBuild ? "http://localhost:3000" : undefined),
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NODE_ENV === "development"
      ? "twin-local-development-secret-change-me"
      : isProductionBuild
        ? "twin-build-time-placeholder-never-used-at-runtime"
        : undefined),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
    },
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {},
});
