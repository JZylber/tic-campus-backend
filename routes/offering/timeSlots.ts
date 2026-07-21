import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import {
  addOfferingTimeSlot,
  updateOfferingTimeSlot,
  deleteOfferingTimeSlot,
} from "../../controllers/offerings/timeSlotMutations.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.post("/:offeringId/timeSlots", requireJwt, requireRole([Role.ADMIN]), addOfferingTimeSlot);
router.patch("/:offeringId/timeSlots/:slotId", requireJwt, requireRole([Role.ADMIN]), updateOfferingTimeSlot);
router.delete("/:offeringId/timeSlots/:slotId", requireJwt, requireRole([Role.ADMIN]), deleteOfferingTimeSlot);

export default router;
