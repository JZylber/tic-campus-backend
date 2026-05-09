import { Router } from "express";
import { getAllSubjects, getTemplateSubjects } from "../../controllers/subjects/allSubjects.ts";
import { getTeacherSubjects } from "../../controllers/students/marks.ts";

const router: Router = Router();

router.get("/", getAllSubjects);
router.get("/teacher/:teacherId", getTeacherSubjects);
router.get("/:templateId", getTemplateSubjects);

export default router;
