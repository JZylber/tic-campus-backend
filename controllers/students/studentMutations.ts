import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";

export async function addStudentToCourse(
  request: Request<{ studentId: string }, {}, { courseId: number }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { courseId } = request.body;

  const existing = await prisma.studentCourse.findFirst({
    where: { studentId, courseId },
  });
  if (existing) {
    return response.status(409).send({ error: "Student already enrolled in this course" });
  }

  const studentCourse = await prisma.studentCourse.create({
    data: { studentId, courseId },
  });
  return response.status(201).send(studentCourse);
}

export async function changeStudentCourse(
  request: Request<{ studentId: string }, {}, { oldCourseId: number; newCourseId: number }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { oldCourseId, newCourseId } = request.body;

  const enrollment = await prisma.studentCourse.findFirst({
    where: { studentId, courseId: oldCourseId },
  });
  if (!enrollment) {
    return response.status(404).send({ error: "Enrollment not found" });
  }

  const updated = await prisma.studentCourse.update({
    where: { id: enrollment.id },
    data: { courseId: newCourseId },
  });
  return response.status(200).send(updated);
}

export async function deleteStudentFromCourse(
  request: Request<{ studentId: string; courseId: string }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const courseId = Number(request.params.courseId);

  const enrollment = await prisma.studentCourse.findFirst({
    where: { studentId, courseId },
  });
  if (!enrollment) {
    return response.status(404).send({ error: "Enrollment not found" });
  }

  const deleted = await prisma.studentCourse.delete({
    where: { id: enrollment.id },
  });
  return response.status(200).send(deleted);
}

export async function updateStudent(
  request: Request<
    { studentId: string },
    {},
    { name?: string; surname?: string; email?: string; dni?: string }
  >,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { name, surname, email, dni } = request.body;

  const data = Object.fromEntries(
    Object.entries({ name, surname, email, dni }).filter(([, v]) => v !== undefined),
  ) as { name?: string; surname?: string; email?: string; dni?: string };

  const updated = await prisma.user.update({
    where: { id: studentId },
    data,
    select: { id: true, name: true, surname: true, email: true, dni: true, role: true },
  });
  return response.status(200).send(updated);
}
