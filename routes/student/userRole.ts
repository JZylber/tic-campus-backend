import { Router } from "express";
import type { Request, Response } from "express";
import requireJwt from "../../middlewares/requireJWT.ts";

const router: Router = Router();

router.get("/role", requireJwt, async (req: Request, res: Response) => {
  try {
    const user = req.user as { role: string };
    return res.status(200).json({ role: user.role });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "An error occurred while fetching user role", error });
  }
});

export default router;
