import { Router } from "express";
import { getStudentData } from "../../controllers/students/auth.ts";

const router: Router = Router();

router.post("/", getStudentData);

export default router;
