import { Router } from "express";
import { getSubjectMaterials } from "../../controllers/subjects/material.ts";

const router: Router = Router();

router.get("/:subject/:course/:year", getSubjectMaterials);

export default router;
