import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import {
  listOfferings,
  listOptionalOfferings,
  listSubjectsCatalog,
} from "../../controllers/offerings/optionalOfferingQueries.ts";
import {
  createOptionalOffering,
  updateOptionalOffering,
  deleteOptionalOffering,
} from "../../controllers/offerings/optionalOfferingMutations.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireJwt, requireRole([Role.ADMIN]), listOfferings);

// Literal paths must be registered before the "/optional/:id" wildcard below.
router.get("/optional/subjects", requireJwt, requireRole([Role.ADMIN]), listSubjectsCatalog);
router.get("/optional", requireJwt, requireRole([Role.ADMIN]), listOptionalOfferings);
router.post("/optional", requireJwt, requireRole([Role.ADMIN]), createOptionalOffering);
router.patch("/optional/:id", requireJwt, requireRole([Role.ADMIN]), updateOptionalOffering);
router.delete("/optional/:id", requireJwt, requireRole([Role.ADMIN]), deleteOptionalOffering);

export default router;
