import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getAllStudents, getSubjectStudents } from "../../controllers/students/allStudents.ts";
import { addStudentToCourse, changeStudentCourse, deleteStudentFromCourse, updateStudent } from "../../controllers/students/studentMutations.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireAuth, requireRole([Role.ADMIN, Role.TEACHER, Role.COUNSELOR]), getAllStudents);
router.get("/:subject/:course/:year", getSubjectStudents);
router.patch("/:studentId", requireAuth, requireRole([Role.ADMIN]), updateStudent);
router.post("/:studentId/course", requireAuth, requireRole([Role.ADMIN]), addStudentToCourse);
router.patch("/:studentId/course", requireAuth, requireRole([Role.ADMIN]), changeStudentCourse);
router.delete("/:studentId/course/:courseId", requireAuth, requireRole([Role.ADMIN]), deleteStudentFromCourse);

export default router;
