import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { setCacheHeaders } from "../shared.ts";

export async function getAllCourses(_request: Request, response: Response) {
  const courses = await prisma.course.findMany({
    select: { id: true, name: true, specialty: true, year: true },
  });
  setCacheHeaders(response, 3600);
  return response.status(200).send(courses);
}
