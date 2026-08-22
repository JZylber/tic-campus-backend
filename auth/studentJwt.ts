import { Strategy, ExtractJwt } from "passport-jwt";
import type { VerifiedCallback } from "passport-jwt";
import type { CookieOptions, Request, Response } from "express";
import jwt from "jsonwebtoken";
import prisma from "../prisma/prisma.ts";
import { Role } from "../generated/prisma/enums.ts";
import type { User } from "../generated/prisma/client.ts";

export const STUDENT_COOKIE_NAME = "ticCampusStudentToken";
export const STUDENT_TOKEN_HEADER = "x-student-token";

// A campus session lasts a school day; one relay each morning is enough.
export const CAMPUS_TOKEN_TTL_SECONDS = 8 * 60 * 60;
// Impersonation grants read access to someone else's record and there is no
// revocation list, so expiry is the only kill switch. Keep it short.
export const IMPERSONATION_TOKEN_TTL_SECONDS = 2 * 60 * 60;

const secret = (): string => process.env.JWT_SECRET || "secret-test";

export type StudentTokenPayload = {
  /** Discriminator. The dashboard strategy in auth/jwt.ts rejects this value. */
  typ: "student";
  /** Our User.id. */
  sub: number;
  /**
   * Carried because year-2025 spreadsheets put the DNI in `Id Estudiante`
   * rather than our User.id, so enforcement has to accept either identifier.
   */
  dni: string | null;
  /**
   * The identifier that goes in request URLs: our User.id, except on 2025 pages
   * where the spreadsheets key on the DNI. Always equal to `sub` or `dni`, so
   * requireStudentSelf accepts it.
   */
  publicId: string;
  role: "STUDENT";
  /** Display-only claims, so the client can render identity from the token alone. */
  name: string | null;
  surname: string | null;
  course: string;
  year: number;
  src: "campus" | "impersonation";
  /** Audit claim: the real person behind an impersonation token. */
  act?: { id: number; role: string };
};

export type StudentRequestUser = User & {
  studentToken: StudentTokenPayload;
};

export function signStudentToken(
  payload: StudentTokenPayload,
  expiresInSeconds: number,
): string {
  return jwt.sign(payload, secret(), { expiresIn: expiresInSeconds });
}

// SameSite=None + Secure + Partitioned: the widget runs on campus.ort.edu.ar
// while this API is on *.vercel.app, and both are separate registrable domains
// (.vercel.app is on the Public Suffix List), so this is unavoidably a
// third-party cookie. Partitioned (CHIPS) keeps Chrome from dropping it; the
// X-Student-Token fallback covers browsers that drop it anyway.
const cookieOptions = (maxAgeMs: number): CookieOptions => ({
  httpOnly: true,
  secure: true,
  sameSite: "none",
  partitioned: true,
  path: "/",
  maxAge: maxAgeMs,
});

export function setStudentCookie(
  response: Response,
  token: string,
  ttlSeconds: number,
): void {
  response.cookie(STUDENT_COOKIE_NAME, token, cookieOptions(ttlSeconds * 1000));
}

export function clearStudentCookie(response: Response): void {
  // Attributes must match the ones the cookie was set with or the browser
  // keeps it.
  response.clearCookie(STUDENT_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
    path: "/",
  });
}

const cookieExtractor = (request: Request): string | null => {
  const token = (request.cookies as Record<string, unknown> | undefined)?.[
    STUDENT_COOKIE_NAME
  ];
  return typeof token === "string" && token.length > 0 ? token : null;
};

const options = {
  // Header before cookie: the header is only ever set deliberately by the
  // client for this request, whereas the cookie is ambient and may be a
  // leftover from a different year's page.
  jwtFromRequest: ExtractJwt.fromExtractors([
    ExtractJwt.fromHeader(STUDENT_TOKEN_HEADER),
    cookieExtractor,
  ]),
  secretOrKey: secret(),
};

async function verify(payload: unknown, done: VerifiedCallback) {
  const claims = payload as Partial<StudentTokenPayload> | null;
  if (claims?.typ !== "student" || typeof claims.sub !== "number") {
    return done(null, false);
  }

  // Deliberately does NOT read googleId or jwtSecureCode: students never go
  // through Google OAuth, and rotating jwtSecureCode here would sign the
  // account out of the standalone dashboard.
  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user || user.role !== Role.STUDENT) {
    return done(null, false);
  }

  const requestUser: StudentRequestUser = Object.assign(user, {
    studentToken: claims as StudentTokenPayload,
  });
  return done(null, requestUser);
}

export default new Strategy(options, verify);
