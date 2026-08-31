import { Router } from "express";
import { Role } from "../../generated/prisma/enums.ts";
import { getAllTeachers } from "../../controllers/teachers/allTeachers.ts";
import requireAuth from "../../middlewares/requireAuth.ts";
import requireRole from "../../middlewares/requireRole.ts";

const router: Router = Router();

router.get("/", requireAuth, requireRole([Role.ADMIN]), getAllTeachers);

export default router;
