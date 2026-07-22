import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import { OfferingKind, Semester } from "../../generated/prisma/enums.ts";
import { composeSubjectName } from "../offerings/offeringQueries.ts";

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export async function matchStudentAvanzado(
  request: Request<{ studentId: string }, {}, { offeringId: number; courseId: number }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const { offeringId, courseId } = request.body;

  if (!isPositiveInt(studentId) || !isPositiveInt(offeringId) || !isPositiveInt(courseId)) {
    return response.status(400).send({ error: "Invalid studentId, offeringId, or courseId" });
  }

  const offering = await prisma.offering.findUnique({
    where: { id: offeringId },
    include: { subject: true },
  });
  if (!offering) {
    return response.status(404).send({ error: "Offering not found" });
  }
  if (offering.kind !== OfferingKind.OPTIONAL || offering.semester !== Semester.SECOND) {
    return response.status(400).send({ error: "Offering is not an avanzado (must be OPTIONAL and SECOND semester)" });
  }

  const studentCourse = await prisma.studentCourse.findFirst({ where: { studentId, courseId } });
  if (!studentCourse) {
    return response.status(404).send({ error: "Student not enrolled in course" });
  }

  const offeringCourse = await prisma.offeringCourse.findFirst({ where: { offeringId, courseId } });
  if (!offeringCourse) {
    return response.status(400).send({ error: "Offering not available for this course" });
  }

  const existing = await prisma.studentOffering.findFirst({ where: { studentId, offeringId } });
  if (existing) {
    return response.status(409).send({ error: "Student already matched to this avanzado" });
  }

  await prisma.studentOffering.create({ data: { studentId, courseId, offeringId } });

  return response.status(201).send({
    offeringId: offering.id,
    subjectName: offering.subject.name,
    name: offering.name,
    displayName: composeSubjectName(offering.subject.name, offering.name),
  });
}

export async function unmatchStudentAvanzado(
  request: Request<{ studentId: string; offeringId: string }>,
  response: Response,
) {
  const studentId = Number(request.params.studentId);
  const offeringId = Number(request.params.offeringId);

  if (!isPositiveInt(studentId) || !isPositiveInt(offeringId)) {
    return response.status(400).send({ error: "Invalid studentId or offeringId" });
  }

  const existing = await prisma.studentOffering.findFirst({ where: { studentId, offeringId } });
  if (!existing) {
    return response.status(404).send({ error: "Match not found" });
  }

  const deleted = await prisma.studentOffering.delete({ where: { id: existing.id } });
  return response.status(200).send(deleted);
}
