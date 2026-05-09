import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getMarksBySubject, getStudentMarks } from "../../controllers/students/marks.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/:subject/:course/:year/:id", getStudentMarks);
router.get("/:subject/:course/:year", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), getMarksBySubject);

export default router;
