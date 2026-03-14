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
    // Check if user already exists
    let user = await prisma.user.findUnique({
      where: { googleId: profile.id },
    });

    // If user doesn't exist, check if there's a user with the same email, and add googleId to that user
    if (!user && profile.emails && profile.emails.length > 0) {
      user = await prisma.user.findUnique({
        where: { email: profile.emails[0]!.value },
      });
      if (user) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: profile.id, jwtSecureCode: uuidv4() },
        });
      }
    }
    // If user still doesn't exist, create a new one, throw an error if email is not available
    if (!user) {
      throw new Error(
        "No hay un mail registrado para esta cuenta de Google. ¡Hablá con Shulian!",
      );
    }
    // Return the user (existing or newly created)
    return done(null, user);
  } catch (error) {
    return done(error as Error);
  }
}

export default new GoogleStrategy(options, verify);
