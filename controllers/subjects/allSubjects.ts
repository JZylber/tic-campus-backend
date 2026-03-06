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
    level: Number(subject.course[2] || 0),
    division: subject.course[3] || "",
    year: subject.year,
    template: subject.templateId,
    spreadsheetId: subject.spreadsheet,
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

export async function getSubjectStudents(
  request: Request<{ subject: string; course: string; year: string }>,
  response: Response,
) {
  const { subject, course, year } = request.params;
  const studentsQuery = await prisma.studentCourse.findMany({
    where: {
      course,
      year: Number(year),
      studentSubjects: {
        some: {
          subject: {
            name: subject,
          },
        },
      },
    },
    include: {
      student: true,
    },
  });
  // Map studentsQuery to an array of students with id, name, surname, year and course
  const students = studentsQuery.map((studentCourse) => ({
    id: studentCourse.student.id,
    name: studentCourse.student.name,
    surname: studentCourse.student.surname,
    year: studentCourse.year,
    course: studentCourse.course,
  }));
  return response.status(200).send(students);
}
