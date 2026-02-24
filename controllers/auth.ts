import { prisma } from "../index.ts";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";

export const googleAuth = async (req: Request<>, res: Response) => {
  const {
    id,
    _json: { name, picture, email },
  } = req.user;

  let user = await prisma.user.findUnique({
    where: {
      googleId: id,
    },
  });

  // If user doesn't exist, search by email and update googleId if found
  if (!user) {
    user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    if (user) {
      user = await prisma.user.update({
        where: {
          id: user.id,
        },
        data: {
          googleId: id,
        },
      });
    }
  }
  // if user does not exist, throw error
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  // Generate tokens
  const token = jwt.sign(
    { _id: user.id, role: user.role },
    process.env.JWT_SECRET!,
    {
      expiresIn: "7d",
    },
  );

  return res.status(200).cookie("token", token).json({
    success: true,
    message: "User login successful",
    user,
    token,
  });
};
