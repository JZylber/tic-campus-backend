import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import {
  listOfferings,
  listSubjectsCatalog,
  getPublicOfferingsBySubjectLevel,
  getSubjectLevels,
} from "../../controllers/offerings/offeringQueries.ts";
import { getOfferingRoster } from "../../controllers/offerings/offeringRoster.ts";
import {
  createOffering,
  updateOffering,
  deleteOffering,
} from "../../controllers/offerings/offeringMutations.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import { requireStudentSelfOrAnonymous } from "../../middlewares/requireStudent.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireAuth, requireRole([Role.ADMIN, Role.TEACHER, Role.COUNSELOR]), listOfferings);
router.get("/subjects", requireAuth, requireRole([Role.ADMIN]), listSubjectsCatalog);
router.get("/:subject/levels", getSubjectLevels);
router.get(
  "/:offeringId/students",
  requireAuth,
  requireRole([Role.ADMIN, Role.TEACHER, Role.COUNSELOR]),
  getOfferingRoster,
);
router.get("/:subject/:year/:level/:studentId", requireStudentSelfOrAnonymous("studentId"), getPublicOfferingsBySubjectLevel);
router.post("/", requireAuth, requireRole([Role.ADMIN]), createOffering);
router.patch("/:id", requireAuth, requireRole([Role.ADMIN]), updateOffering);
router.delete("/:id", requireAuth, requireRole([Role.ADMIN]), deleteOffering);

export default router;
