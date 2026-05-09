import { Strategy, ExtractJwt } from "passport-jwt";
import type { VerifiedCallback } from "passport-jwt";
import type { Request } from "express";
import prisma from "../prisma/prisma.ts";

const cookieExtractor = (req: Request): string | null => {
  const token = req?.cookies?.ticCampusAccessToken;
  return typeof token === "string" ? token : null;
};

const options = {
  jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
  secretOrKey: process.env.JWT_SECRET || "secret-test",
};

async function verify(payload: any, done: VerifiedCallback) {
  if (
    !payload?.id ||
    !payload?.googleId ||
    !payload?.jwtSecureCode ||
    !payload?.role
  ) {
    return done(null, false);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.id,
      googleId: payload.googleId,
      role: payload.role,
    },
  });

  if (!user) {
    return done(null, false);
  }

  if (!user.googleId || !user.jwtSecureCode) {
    return done(null, false);
  }

  if (user.jwtSecureCode !== payload.jwtSecureCode) {
    return done(null, false);
  }

  return done(null, user);
}

export default new Strategy(options, verify);
