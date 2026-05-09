// authRoute.ts
import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import passport from "../auth/passport.ts";
import jwt from "jsonwebtoken";

const router: Router = Router();

const toOrigin = (url: string | undefined): string | null => {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const allowedOrigins = [
  toOrigin(process.env.FE_BASE_URL),
  toOrigin(process.env.FE_EMBED_URL),
].filter((origin): origin is string => Boolean(origin));

const isAllowedReturnTo = (returnTo: string): boolean => {
  try {
    const url = new URL(returnTo);
    return allowedOrigins.includes(url.origin);
  } catch {
    return false;
  }
};

const encodeState = (returnTo: string): string =>
  Buffer.from(JSON.stringify({ returnTo }), "utf8").toString("base64url");

const decodeReturnTo = (state: unknown): string | null => {
  if (typeof state !== "string" || state.length === 0) return null;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
    if (
      parsed &&
      typeof parsed.returnTo === "string" &&
      isAllowedReturnTo(parsed.returnTo)
    ) {
      return parsed.returnTo;
    }
  } catch {
    // fall through
  }
  return null;
};

// Kick off the Google OAuth flow. Optional ?returnTo=<url> is round-tripped
// through OAuth state so the callback can redirect the user back to where
// they started (standalone vs embedded FE).
router.get("/google", (req: Request, res: Response, next: NextFunction) => {
  const returnToParam = req.query.returnTo;
  const returnTo =
    typeof returnToParam === "string" && isAllowedReturnTo(returnToParam)
      ? returnToParam
      : null;

  const authenticator = returnTo
    ? passport.authenticate("google", {
        scope: ["profile", "email"],
        state: encodeState(returnTo),
      })
    : passport.authenticate("google", { scope: ["profile", "email"] });

  return authenticator(req, res, next);
});

// Google OAuth callback. Sets an httpOnly cookie containing the JWT and
// redirects back to the FE (returnTo if valid, otherwise FE_BASE_URL).
router.get(
  "/google/callback",
  passport.authenticate("google", { session: false }),
  (req: Request, res: Response) => {
    try {
      const user = req.user as {
        id: number;
        googleId: string;
        jwtSecureCode: string;
        role: string;
      };

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

      // SameSite=None + Secure works in both dev (browsers special-case
      // localhost) and prod (HTTPS), and is required when the FE is loaded
      // inside a third-party origin (cross-site requests).
      res.cookie("accessToken", authToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000,
      });

      const returnTo = decodeReturnTo(req.query.state);
      const redirectUrl = returnTo ?? process.env.FE_BASE_URL ?? "/";
      return res.redirect(redirectUrl);
    } catch (error) {
      return res
        .status(500)
        .json({ message: "An error occurred during authentication", error });
    }
  },
);

export default router;
