import { Router } from "express";
import { getAllStudents } from "../../controllers/students/allStudents.ts";
import { getSubjectStudents } from "../../controllers/subjects/allSubjects.ts";

const router = Router();

router.get("/", getAllStudents);
router.get("/:subject/:course/:year", getSubjectStudents);

export default router;
