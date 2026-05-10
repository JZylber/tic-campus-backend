import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { Role } from "../../generated/prisma/enums.ts";

export async function getAllTeachers(request: Request, response: Response) {
  const teachers = await prisma.user.findMany({
    where: { role: Role.TEACHER },
    select: { id: true, name: true, surname: true },
    orderBy: { surname: "asc" },
  });
  return response.status(200).json(teachers);
}
