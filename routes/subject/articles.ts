import { Router } from "express";
import { getSubjectArticles } from "../../controllers/subjects/articles.ts";

const router: Router = Router();

router.get("/:subject/:course/:year", getSubjectArticles);

export default router;
