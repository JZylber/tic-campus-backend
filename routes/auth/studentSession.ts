import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import {
  endStudentSession,
  impersonateStudent,
  startCampusSession,
} from "../../controllers/students/session.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.post("/campus/session", startCampusSession);
router.delete("/campus/session", endStudentSession);
router.post("/impersonate", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), impersonateStudent);

export default router;
