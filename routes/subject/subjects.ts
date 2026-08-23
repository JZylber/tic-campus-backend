import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getAllSubjects, getTemplateSubjects, getTeacherSubjects } from "../../controllers/subjects/allSubjects.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", getAllSubjects);
router.get("/teacher/:teacherId", requireAuth, requireRole([Role.ADMIN, Role.TEACHER]), getTeacherSubjects);
router.get("/:templateId", getTemplateSubjects);

export default router;
