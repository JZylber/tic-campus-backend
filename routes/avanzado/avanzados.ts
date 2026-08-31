import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { listAvanzadoStudents } from "../../controllers/avanzados/avanzadoQueries.ts";
import { matchStudentAvanzado, unmatchStudentAvanzado } from "../../controllers/avanzados/avanzadoMutations.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/students", requireAuth, requireRole([Role.ADMIN]), listAvanzadoStudents);
router.post("/students/:studentId/matches", requireAuth, requireRole([Role.ADMIN]), matchStudentAvanzado);
router.delete("/students/:studentId/matches/:offeringId", requireAuth, requireRole([Role.ADMIN]), unmatchStudentAvanzado);

export default router;
