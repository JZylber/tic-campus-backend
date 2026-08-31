import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getRevisionRequests, getRevisionRequestsByTeacher, toggleRevisionRequestReviewed } from "../../controllers/subjects/revision.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import requireStudent, { requireStudentSelf } from "../../middlewares/requireStudent.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/teacher/:year/:teacherId", requireAuth, requireRole([Role.ADMIN, Role.TEACHER]), getRevisionRequestsByTeacher);
router.get("/:subject/:course/:year/:id", requireStudent, requireStudentSelf("id"), getRevisionRequests);
router.patch("/:id/reviewed", requireAuth, requireRole([Role.ADMIN, Role.TEACHER]), toggleRevisionRequestReviewed);

export default router;
