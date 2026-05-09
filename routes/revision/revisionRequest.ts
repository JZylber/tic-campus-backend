import { Router } from "express";
import { requestRevision } from "../../controllers/subjects/revision.ts";

const router = Router();

router.post("/", requestRevision);

export default router;
