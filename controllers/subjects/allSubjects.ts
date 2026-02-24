import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";

type Subject = {
  name: string;
  course: string;
  level: number;
  division: string;
  year: number;
};

export async function getAllSubjects(request: Request, response: Response) {
  // Select subjects where course is not empty, and order by year desc, name asc and course asc
  const subjectsQuery = await prisma.subject.findMany({
    where: {
      course: {
        not: "",
      },
    },
    orderBy: [
      {
        year: "desc",
      },
      {
        name: "asc",
      },
      {
        course: "asc",
      },
    ],
  });
  const subjects: Subject[] = subjectsQuery.map((subject) => ({
    name: subject.name,
    course: subject.course,
    level: Number(subject.course.match(/\d+/)?.[0] || 0),
    division: subject.course.match(/\d+([A-Za-z]*)/)?.[1] || "",
    year: subject.year,
  }));
  return response.status(200).send(subjects);
}

export async function getTemplateSubjects(
  request: Request<{ templateId: string }>,
  response: Response,
) {
  const { templateId } = request.params;
  // Select subjects where course is not empty and templateId matches. Order by year desc, name asc and course asc
  const subjectsQuery = await prisma.subject.findMany({
    where: {
      course: {
        not: "",
      },
      templateId,
    },
    orderBy: [
      {
        year: "desc",
      },
      {
        name: "asc",
      },
      {
        course: "asc",
      },
    ],
  });
  return response.status(200).send(subjectsQuery);
}
