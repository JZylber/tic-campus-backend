import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getMarksBySubject, getStudentMarks } from "../../controllers/students/marks.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/:subject/:course/:year/:id", getStudentMarks);
router.get("/:subject/:course/:year", requireAuth, requireRole([Role.ADMIN, Role.TEACHER]), getMarksBySubject);

export default router;
