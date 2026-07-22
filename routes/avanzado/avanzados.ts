import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { listAvanzadoStudents } from "../../controllers/avanzados/avanzadoQueries.ts";
import { matchStudentAvanzado, unmatchStudentAvanzado } from "../../controllers/avanzados/avanzadoMutations.ts";
import requireJwt from "../../middlewares/requireJWT.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/students", requireJwt, requireRole([Role.ADMIN]), listAvanzadoStudents);
router.post("/students/:studentId/matches", requireJwt, requireRole([Role.ADMIN]), matchStudentAvanzado);
router.delete("/students/:studentId/matches/:offeringId", requireJwt, requireRole([Role.ADMIN]), unmatchStudentAvanzado);

export default router;
