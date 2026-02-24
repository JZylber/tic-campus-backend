import { Router } from "express";
import passport from "passport";
import { googleAuth } from "./controllers/auth.ts";

const router: Router = Router();

// Login with Google
router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  }),
);

// Google callback
router.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    session: false,
    failureMessage: "Failed to login with Google",
  }),
  googleAuth,
);

export default router;
