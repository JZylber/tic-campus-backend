// serviceAccount.ts
import { Buffer } from "node:buffer";
import { timingSafeEqual } from "node:crypto";
import { Role } from "../generated/prisma/enums.ts";

// Minimum length so a short or placeholder SERVICE_API_KEY can never become a valid credential.
const MIN_KEY_LENGTH = 32;

// Mirrors the Prisma User row that auth/jwt.ts puts on req.user, so the existing
// `req.user as { ... }` casts in the routes keep working. id -1 never collides with a real row.
export const SERVICE_USER = {
  id: -1,
  dni: null,
  email: "service-account@tic-campus.local",
  name: "Service",
  surname: "Account",
  googleId: null,
  jwtSecureCode: null,
  role: Role.TEACHER,
  isService: true,
} as const;

const safeEqual = (a: string, b: string): boolean => {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
};

// Read from the environment on every call so import order and Vercel cold starts can't leave it stale.
export const isValidServiceKey = (presented: string | undefined): boolean => {
  const expected = process.env.SERVICE_API_KEY;
  // No key configured (or a weak one) disables service-account auth entirely.
  if (!expected || expected.length < MIN_KEY_LENGTH) return false;
  if (!presented) return false;
  return safeEqual(presented, expected);
};
