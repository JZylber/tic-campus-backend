import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getRevisionRequests } from "../../controllers/students/marks.ts";
import { getRevisionRequestsByTeacher, toggleRevisionRequestReviewed } from "../../controllers/subjects/revision.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/teacher/:year/:teacherId", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), getRevisionRequestsByTeacher);
router.get("/:subject/:course/:year/:id", getRevisionRequests);
router.patch("/:id/reviewed", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), toggleRevisionRequestReviewed);

export default router;
