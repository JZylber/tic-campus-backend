import type { Request, Response } from "express";

import Fuse from "fuse.js";
import { setCacheHeaders } from "../shared.ts";
import prisma from "../../prisma/prisma.ts";

export async function getStudentData(
  request: Request<{}, {}, { name: string; surname: string; year: number }>,
  response: Response,
) {
  const { name, surname, year } = request.body;
  const studentsQuery = await prisma.user.findMany({
    where: {
      studentCourses: {
        some: {
          course: {
            year: year,
          },
        },
      },
    },
    include: {
      studentCourses: {
        include: {
          course: true,
        },
      },
    },
  });
  const students = studentsQuery.map((student) => ({
    id: student.id,
    name: student.name!,
    surname: student.surname!,
    dni: student.dni,
    email: student.email,
    studentCourses: student.studentCourses.map((studentCourse) => ({
      course: studentCourse.course.name,
      year: studentCourse.course.year,
    })),
  }));
  const fuse = new Fuse(students, {
    keys: ["name", "surname"],
    threshold: 0.4,
  });
  const possibleStudents = fuse.search({ name: name, surname: surname });
  if (possibleStudents.length === 0) {
    return response
      .status(404)
      .send({ message: "No student found with the given name and surname." });
  }
  let studentId = possibleStudents[0]!.item.id;
  let currentCourse = possibleStudents[0]!.item.studentCourses.find(
    (studentCourse) => studentCourse.year === year,
  )?.course;
  // IF year is 2025, use DNI as student ID
  if (year === 2025) {
    studentId = parseInt(possibleStudents[0]!.item.dni);
  }
  // Set cache headers for 10 minutes
  setCacheHeaders(response, 600);
  return response.status(200).send({ id: studentId, course: currentCourse });
}
