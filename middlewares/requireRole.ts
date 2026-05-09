import type { Request, Response, NextFunction } from "express";
import { Role } from "../generated/prisma/enums.ts";

const requireRole =
  (roles: Role[]) => (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as { role: Role };
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };

export default requireRole;
