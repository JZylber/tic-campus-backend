import { Router } from "express";
import { getAllCourses } from "../../controllers/courses/allCourses.ts";

const router: Router = Router();

router.get("/", getAllCourses);

export default router;
