import { Router } from "express";
import type { Request, Response } from "express";
import requireJwt from "../../middlewares/requireJWT.ts"; // our middleware to authenticate using JWT
import google from "../../auth/google.ts";

const router: Router = Router();

// mock user info endpoint to return user data
router.get("/", requireJwt, async (req: Request, res: Response) => {
  try {
    /* 
       The requireJwt middleware authenticates the request by verifying 
       the accessToken. Once authenticated, it attaches the User object 
       to req.user (see `jwt.ts`), making it availabe in the subsequent route handlers, 
       like those in userRoute.
    */
    // req.user is populated after passing through the requireJwt
    // middleware
    const user = req.user as {
      id: number;
      googleId: string;
      jwtSecureCode: string;
      role: string;
    };
    // it is a mock, you MUST return only the necessary info :)
    return res
      .status(200)
      .json({ id: user.id, googleId: user.googleId, role: user.role });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "An error occurred while fetching user info", error });
  }
});

export default router;
