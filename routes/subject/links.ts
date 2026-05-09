import { Router } from "express";
import { getHomeLinks } from "../../controllers/subjects/links.ts";

const router: Router = Router();

router.get("/:subject/:course/:year", getHomeLinks);

export default router;
