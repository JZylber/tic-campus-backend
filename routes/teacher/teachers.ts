import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getAllTeachers } from "../../controllers/teachers/allTeachers.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireJwt, requireRole([Role.ADMIN]), getAllTeachers);

export default router;
