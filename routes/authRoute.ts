// authRoute.ts
import { Router } from "express";
import type { Request, Response } from "express";
import passport from "../auth/passport.ts"; // import passport from our custom passport file
import jwt from "jsonwebtoken"; // import jsonwebtoken to sign JWTs

const router: Router = Router();

/*
  This route triggers the Google sign-in/sign-up flow. 
  When the frontend calls it, the user will be redirected to the 
  Google accounts page to log in with their Google account.
*/
// Google OAuth2.0 route
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

/*
  This route is the callback endpoint for Google OAuth2.0. 
  After the user logs in via Google's authentication flow, they are redirected here.
  Passport.js processes the callback, attaches the user to req.user, and we handle 
  the access token generation and redirect the user to the frontend.
*/
// Google OAuth2.0 callback route
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req: Request, res: Response) => {
    try {
      // we can use req.user because the GoogleStrategy that we've
      // implemented in `google.ts` attaches the user
      const user = req.user as {
        id: number;
        googleId: string;
        jwtSecureCode: string;
        role: string;
      };

      // handle the google callback, generate auth token with id, googleId, jwtSecureCode and role
      const authToken = jwt.sign(
        {
          id: user.id,
          googleId: user.googleId,
          jwtSecureCode: user.jwtSecureCode,
          role: user.role,
        },
        process.env.JWT_SECRET || "secret-test",
        { expiresIn: "1d" },
      );
      // respond auth token as cookie
      res.cookie("accessToken", authToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // set secure flag in production
        sameSite: "lax", // set sameSite attribute for CSRF protection
        maxAge: 24 * 60 * 60 * 1000, // 1 day
      });
      // redirect to frontend with the accessToken as query param
      const redirectUrl = `${process.env.FE_BASE_URL}`;
      return res.redirect(redirectUrl);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "An error occurred during authentication", error });
    }
  },
);

export default router;
