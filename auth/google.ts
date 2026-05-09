// google.ts
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { VerifyCallback, Profile } from "passport-google-oauth20";
import prisma from "../prisma/prisma.ts";
import { v4 as uuidv4 } from "uuid";

const options = {
  clientID: process.env.GOOGLE_CLIENT_ID || "",
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  callbackURL: `${process.env.BE_BASE_URL}/auth/google/callback`,
};

async function verify(
  accessToken: string,
  refreshToken: string,
  profile: Profile,
  done: VerifyCallback,
) {
  try {
    let user = await prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    // First time signing in via Google: link by email if a row already exists.
    if (!user && profile.emails && profile.emails.length > 0) {
      const matched = await prisma.user.findUnique({
        where: { email: profile.emails[0]!.value },
      });
      if (matched) {
        user = await prisma.user.update({
          where: { id: matched.id },
          data: { googleId: profile.id },
        });
      }
    }

    if (!user) {
      throw new Error(
        "No hay un mail registrado para esta cuenta de Google. ¡Hablá con Shulian!",
      );
    }

    // Rotate jwtSecureCode on every login → invalidates any prior JWTs.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { jwtSecureCode: uuidv4() },
    });

    return done(null, user);
  } catch (error) {
    return done(error as Error);
  }
}

export default new GoogleStrategy(options, verify);
