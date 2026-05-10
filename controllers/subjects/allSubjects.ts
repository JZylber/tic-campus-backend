import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { setCacheHeaders } from "../shared.ts";

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
    include: {
      course: true,
    },
    orderBy: [
      {
        course: {
          year: "desc",
        },
      },
      {
        name: "asc",
      },
      {
        course: {
          name: "asc",
        },
      },
    ],
  });
  const subjects: Subject[] = subjectsQuery.map((subject) => ({
    name: subject.name,
    course: subject.course.name,
    level: Number(subject.course.name[2] || 0),
    division: subject.course.name[3] || "",
    year: subject.course.year,
    template: subject.templateId,
    spreadsheetId: subject.spreadsheetId,
  }));
  return response.status(200).send(subjects);
}

export async function getTemplateSubjects(
  request: Request<{ templateId: string }>,
  response: Response,
) {
  const { templateId } = request.params;
  // Select subjects where course is not empty and templateId matches. Order by year desc, name asc and course asc
  const subjectsQuery = (
    await prisma.subject.findMany({
      where: {
        templateId,
      },
      orderBy: [
        {
          course: {
            year: "desc",
          },
        },
        {
          name: "asc",
        },
        {
          course: {
            name: "asc",
          },
        },
      ],
      include: {
        course: true,
      },
    })
  ).map((subject) => ({
    ...subject,
    course: subject.course.name,
    year: subject.course.year,
  }));
  // Set Cache Control, CDN-Cache-Control and Vercel-CDN-Cache-Control to one hour (3600 seconds)
  setCacheHeaders(response, 3600);
  return response.status(200).send(subjectsQuery);
}

export async function getTeacherSubjects(
  request: Request<{ teacherId: string }, {}, {}, {}>,
  response: Response,
) {
  const user = request.user as { id: number; role: string };
  const teacherId =
    user.role === "TEACHER" ? user.id : parseInt(request.params.teacherId);
  const subjects = await prisma.subject.findMany({
    where: {
      teacherSubjects: {
        some: {
          teacherId: teacherId,
        },
      },
    },
    select: {
      name: true,
      course: {
        select: {
          name: true,
          year: true,
        },
      },
      spreadsheetId: true,
    },
  });
  const flattenedSubjects = subjects.map((subject) => ({
    name: subject.name,
    course: subject.course.name,
    year: subject.course.year,
    dataSheetId: subject.spreadsheetId,
  }));
  return response.status(200).send(flattenedSubjects);
}
