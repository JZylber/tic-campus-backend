import { Router } from "express";
import type { Request, Response } from "express";
import requireJwt from "../../middlewares/requireJWT.ts";

const router: Router = Router();

router.get("/info", requireJwt, async (req: Request, res: Response) => {
  try {
    const user = req.user as { id: number; name: string | null; surname: string | null; role: string };
    return res.status(200).json({ id: user.id, name: user.name, surname: user.surname, role: user.role });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "An error occurred while fetching user info", error });
  }
});

export default router;
