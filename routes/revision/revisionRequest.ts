import { Router } from "express";
import { requestRevision } from "../../controllers/subjects/revision.ts";
import requireStudent from "../../middlewares/requireStudent.ts";

const router: Router = Router();

router.post("/", requireStudent, requestRevision);

export default router;
