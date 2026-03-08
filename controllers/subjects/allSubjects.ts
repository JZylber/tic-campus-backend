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
  return response.status(200).send(subjectsQuery);
}

export async function getSubjectStudents(
  request: Request<{ subject: string; course: string; year: string }>,
  response: Response,
) {
  const { subject, course, year } = request.params;
  const studentsQuery = await prisma.studentCourse.findMany({
    where: {
      course: {
        name: course,
        year: Number(year),
        subjects: {
          some: {
            name: subject,
          },
        },
      },
    },
    include: {
      student: true,
      course: true,
    },
  });
  // Map studentsQuery to an array of students with id, name, surname, year and course
  const students = studentsQuery.map((studentCourse) => ({
    id: studentCourse.student.id,
    name: studentCourse.student.name,
    surname: studentCourse.student.surname,
    year: studentCourse.course.year,
    course: studentCourse.course.name,
  }));
  return response.status(200).send(students);
}
