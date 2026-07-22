import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { Role } from "../../generated/prisma/enums.ts";

type StudentCourseEntry = {
  courseId: number;
  course: string;
  year: number;
};

type SubjectEntry = {
  subject: string;
  id_course: number;
};

type StudentResponse = {
  id: number;
  name: string;
  surname: string;
  dni: string | null;
  email: string;
  courses: StudentCourseEntry[];
  subjects: SubjectEntry[];
  optionalOfferingIds: number[];
};

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
        offeringCourses: {
          some: {
            offering: {
              subject: {
                name: subject,
              },
            },
          },
        },
      },
    },
    include: {
      student: true,
      course: true,
    },
  });
  const students = studentsQuery.map((studentCourse) => ({
    id: studentCourse.student.id,
    name: studentCourse.student.name,
    surname: studentCourse.student.surname,
    year: studentCourse.course.year,
    course: studentCourse.course.name,
  }));
  return response.status(200).send(students);
}

export async function getAllStudents(_request: Request, response: Response) {
  const studentsQuery = await prisma.user.findMany({
    where: { role: Role.STUDENT },
    select: {
      id: true,
      name: true,
      surname: true,
      dni: true,
      email: true,
      studentCourses: {
        select: {
          course: {
            select: {
              id: true,
              name: true,
              year: true,
              offeringCourses: {
                orderBy: { offering: { subject: { name: "asc" } } },
                select: {
                  courseId: true,
                  offering: { select: { subject: { select: { name: true } } } },
                },
              },
            },
          },
          studentOfferings: {
            select: { eligible: { select: { offeringId: true } } },
          },
        },
      },
    },
  });
  const students: StudentResponse[] = studentsQuery.map((user) => ({
    id: user.id,
    name: user.name!,
    surname: user.surname!,
    dni: user.dni,
    email: user.email,
    courses: user.studentCourses.map(({ course }) => ({
      courseId: course.id,
      course: course.name,
      year: course.year,
    })),
    subjects: user.studentCourses.flatMap(({ course }) =>
      course.offeringCourses.map((oc) => ({
        subject: oc.offering.subject.name,
        id_course: oc.courseId,
      }))
    ),
    optionalOfferingIds: user.studentCourses.flatMap(({ studentOfferings }) =>
      studentOfferings.map((so) => so.eligible.offeringId)
    ),
  }));
  return response.status(200).send(students);
}
