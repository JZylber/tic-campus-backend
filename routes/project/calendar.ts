import { Router } from "express";
import { getCalendar } from "../../controllers/project/calendar.ts";

const router: Router = Router();

router.get("/:subject/:course/:year", getCalendar);

export default router;
