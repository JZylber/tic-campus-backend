import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { setCacheHeaders } from "../shared.ts";
import { getAllSubjects } from "../subjects/allSubjects.ts";

type Student = {
  id: string;
  name: string;
  surname: string;
  dni: string;
  email: string;
  year: number;
  course: string;
};

export async function getAllStudents(request: Request, response: Response) {
  const studentsQueryPromise = prisma.studentCourse.findMany({
    include: {
      student: true,
    },
  });
  const subjectsQueryPromise = prisma.subject.findMany();
  const [studentsQuery, subjectsQuery] = await Promise.all([
    studentsQueryPromise,
    subjectsQueryPromise,
  ]);
  const students: Student[] = studentsQuery.map((studentCourse) => ({
    id: studentCourse.student.id.toString(),
    name: studentCourse.student.name!,
    surname: studentCourse.student.surname!,
    dni: studentCourse.student.dni,
    email: studentCourse.student.email,
    year: studentCourse.year,
    course: studentCourse.course,
    subjects: subjectsQuery
      .filter(
        (subject) =>
          subject.course === studentCourse.course &&
          subject.year === studentCourse.year,
      )
      .map((subject) => subject.name),
  }));
  // If year is 2025, id is equal to dni, otherwise is the id in database
  const studentsWithId = students.map((student) => ({
    ...student,
    id: student.year === 2025 ? student.dni : student.id,
  }));
  // Set Cache Control, CDN-Cache-Control and Vercel-CDN-Cache-Control to 1 hour
  setCacheHeaders(response, 3600);
  return response.status(200).send(studentsWithId);
}
