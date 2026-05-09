import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getRevisionRequests } from "../../controllers/students/marks.ts";
import { getRevisionRequestsByTeacher } from "../../controllers/subjects/revision.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/teacher/:year/:teacherId", requireJwt, requireRole([Role.ADMIN, Role.TEACHER]), getRevisionRequestsByTeacher);
router.get("/:subject/:course/:year/:id", getRevisionRequests);

export default router;
