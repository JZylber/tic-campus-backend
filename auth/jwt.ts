import { Strategy, ExtractJwt } from "passport-jwt";
import type { VerifiedCallback } from "passport-jwt";
import bcrypt from "bcrypt";
import prisma from "../prisma/prisma.ts";

const options = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET || "secret-test",
};

async function verify(payload: any, done: VerifiedCallback) {
  console.log("Verifying JWT with payload:", payload); // Debug log to check the payload structure
  /* 
    a valid JWT must have `id`, `googleId`, `jwtSecureCode` and `role`.
    you can create your JWT like the way you like.
  */
  // bad path: JWT is not valid
  if (
    !payload?.id ||
    !payload?.googleId ||
    !payload?.jwtSecureCode ||
    !payload?.role
  ) {
    return done(null, false);
  }

  // try to find a User with the `id` in the JWT payload and role.
  const user = await prisma.user.findUnique({
    where: {
      id: payload.id,
      googleId: payload.googleId,
      role: payload.role,
    },
  });

  // bad path: User is not found.
  if (!user) {
    return done(null, false);
  }

  // bad path: User does not have googleId or jwtSecureCode.
  if (!user.googleId || !user.jwtSecureCode) {
    return done(null, false);
  }

  // compare User's jwtSecureCode with the JWT's `jwtSecureCode` that the
  // request has.
  // bad path: bad JWT
  if (!bcrypt.compareSync(user.jwtSecureCode, payload.jwtSecureCode)) {
    return done(null, false);
  }

  // happy path: JWT is valid, we auth the User.
  return done(null, user);
}

export default new Strategy(options, verify);
