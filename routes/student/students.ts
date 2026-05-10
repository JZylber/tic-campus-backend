import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getAllStudents, getSubjectStudents } from "../../controllers/students/allStudents.ts";
import { addStudentToCourse, changeStudentCourse, updateStudent } from "../../controllers/students/studentMutations.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), getAllStudents);
router.get("/:subject/:course/:year", getSubjectStudents);
router.patch("/:studentId", requireJwt, requireRole([Role.ADMIN]), updateStudent);
router.post("/:studentId/course", requireJwt, requireRole([Role.ADMIN]), addStudentToCourse);
router.patch("/:studentId/course", requireJwt, requireRole([Role.ADMIN]), changeStudentCourse);

export default router;
