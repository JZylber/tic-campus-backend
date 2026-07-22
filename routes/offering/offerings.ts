import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import {
  listOfferings,
  listSubjectsCatalog,
  getPublicOfferingsBySubjectLevel,
} from "../../controllers/offerings/offeringQueries.ts";
import {
  createOffering,
  updateOffering,
  deleteOffering,
} from "../../controllers/offerings/offeringMutations.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireJwt, requireRole([Role.ADMIN, Role.TEACHER, Role.COUNSELOR]), listOfferings);
router.get("/subjects", requireJwt, requireRole([Role.ADMIN]), listSubjectsCatalog);
router.get("/:subject/:year/:level/:studentId", getPublicOfferingsBySubjectLevel);
router.post("/", requireJwt, requireRole([Role.ADMIN]), createOffering);
router.patch("/:id", requireJwt, requireRole([Role.ADMIN]), updateOffering);
router.delete("/:id", requireJwt, requireRole([Role.ADMIN]), deleteOffering);

export default router;
