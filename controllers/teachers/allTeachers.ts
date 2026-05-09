import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { Role } from "../../generated/prisma/enums.ts";
import { setCacheHeaders } from "../shared.ts";

export async function getAllTeachers(request: Request, response: Response) {
  const teachers = await prisma.user.findMany({
    where: { role: Role.TEACHER },
    select: { id: true, name: true, surname: true },
    orderBy: { surname: "asc" },
  });
  setCacheHeaders(response, 3600);
  return response.status(200).json(teachers);
}
