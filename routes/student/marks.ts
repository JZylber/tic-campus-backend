import { Router } from "express";
import { getMarksBySubject, getStudentMarks } from "../../controllers/students/marks.ts";

const router = Router();

router.get("/:subject/:course/:year/:id", getStudentMarks);
router.get("/:subject/:course/:year", getMarksBySubject);

export default router;
