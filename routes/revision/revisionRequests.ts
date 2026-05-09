import { Router } from "express";
import { getRevisionRequests } from "../../controllers/students/marks.ts";
import { getRevisionRequestsByTeacher } from "../../controllers/subjects/revision.ts";

const router = Router();

router.get("/teacher/:year/:teacherId", getRevisionRequestsByTeacher);
router.get("/:subject/:course/:year/:id", getRevisionRequests);

export default router;
