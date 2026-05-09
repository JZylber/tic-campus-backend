import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getAllStudents } from "../../controllers/students/allStudents.ts";
import { getSubjectStudents } from "../../controllers/subjects/allSubjects.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), getAllStudents);
router.get("/:subject/:course/:year", getSubjectStudents);

export default router;
