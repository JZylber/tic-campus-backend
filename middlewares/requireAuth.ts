// requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import passport from "../auth/passport.ts";
import { isValidServiceKey, SERVICE_USER } from "../auth/serviceAccount.ts";

const requireJwt = passport.authenticate("jwtAuth", { session: false });

// Authenticates either a service account (X-API-Key header, TEACHER permissions)
// or a real user (Authorization: Bearer <jwt>). Role gating stays with requireRole.
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (isValidServiceKey(req.get("X-API-Key"))) {
    req.user = SERVICE_USER;
    return next();
  }
  return requireJwt(req, res, next);
};

export default requireAuth;
