import type { Request, Response } from "express";
import prisma from "../../prisma/prisma.ts";
import {
  buildDisplayName,
  composeSubjectName,
  levelFromCourses,
  countCoursesForLevelYear,
} from "./optionalOfferingQueries.ts";

type Course = { id: number; name: string; year: number };

const isPositiveInt = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

const isNonEmptyPositiveIntArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length > 0 && value.every(isPositiveInt);

const isOptionalString = (value: unknown): value is string | undefined =>
  value === undefined || typeof value === "string";

const isOptionalNullableString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string";

function levelOf(course: Course): number {
  return Number(course.name[2] || 0);
}

// Validates that a set of courses is consistent for a single optional
// offering: all belong to the same calendar year, all share the same
// level (3rd or 4th), and that level is one of the two this feature covers.
function validateCourseSet(
  courses: Course[],
  year: number,
): { error: string } | null {
  const mismatchedYear = courses.find((c) => c.year !== year);
  if (mismatchedYear) {
    return { error: `Course ${mismatchedYear.name} does not belong to year ${year}` };
  }
  const levels = new Set(courses.map(levelOf));
  if (levels.size > 1) {
    return { error: "All selected courses must belong to the same level" };
  }
  const [level] = levels;
  if (level !== 3 && level !== 4) {
    return { error: "Selected courses must belong to level 3 or 4" };
  }
  return null;
}

export async function createOptionalOffering(
  request: Request<
    {},
    {},
    {
      subjectId: number;
      year?: number;
      courseIds: number[];
      templateId?: string;
      spreadsheetId?: string | null;
      name?: string | null;
    }
  >,
  response: Response,
) {
  const { subjectId, courseIds, templateId, spreadsheetId, name } = request.body;
  const yearInput = request.body.year;

  if (!isPositiveInt(subjectId)) {
    return response.status(400).send({ error: "Invalid subjectId" });
  }
  if (!isNonEmptyPositiveIntArray(courseIds)) {
    return response.status(400).send({ error: "courseIds is required" });
  }
  if (yearInput !== undefined && !isPositiveInt(yearInput)) {
    return response.status(400).send({ error: "Invalid year" });
  }
  if (!isOptionalString(templateId)) {
    return response.status(400).send({ error: "Invalid templateId" });
  }
  if (!isOptionalNullableString(spreadsheetId)) {
    return response.status(400).send({ error: "Invalid spreadsheetId" });
  }
  if (!isOptionalNullableString(name)) {
    return response.status(400).send({ error: "Invalid name" });
  }

  const year = yearInput ?? new Date().getFullYear();
  const uniqueCourseIds = [...new Set(courseIds)];

  const subject = await prisma.subject.findUnique({ where: { id: subjectId } });
  if (!subject) {
    return response.status(404).send({ error: "Subject not found" });
  }

  const courses = await prisma.course.findMany({ where: { id: { in: uniqueCourseIds } } });
  if (courses.length !== uniqueCourseIds.length) {
    return response.status(400).send({ error: "One or more courseIds do not exist" });
  }

  const courseSetError = validateCourseSet(courses, year);
  if (courseSetError) {
    return response.status(400).send(courseSetError);
  }

  const offering = await prisma.$transaction(async (tx) => {
    const created = await tx.offering.create({
      data: {
        subjectId,
        year,
        kind: "OPTIONAL",
        templateId: templateId ?? "",
        spreadsheetId: spreadsheetId ?? null,
        name: name ?? null,
      },
    });
    await tx.offeringCourse.createMany({
      data: uniqueCourseIds.map((courseId) => ({ offeringId: created.id, courseId })),
    });
    return created;
  });

  const offeringCourses = courses.map((course) => ({ courseId: course.id, course }));
  const level = levelFromCourses(offeringCourses);
  const totalForLevel = await countCoursesForLevelYear(year, level);
  return response.status(201).send({
    id: offering.id,
    subjectId: offering.subjectId,
    subjectName: subject.name,
    name: offering.name,
    year: offering.year,
    level,
    templateId: offering.templateId,
    spreadsheetId: offering.spreadsheetId,
    displayName: buildDisplayName(
      composeSubjectName(subject.name, offering.name),
      offeringCourses,
      totalForLevel,
    ),
    courses: courses.map((course) => ({
      courseId: course.id,
      courseName: course.name,
      division: course.name[3] || "",
    })),
  });
}

export async function updateOptionalOffering(
  request: Request<
    { id: string },
    {},
    {
      courseIds?: number[];
      templateId?: string;
      spreadsheetId?: string | null;
      name?: string | null;
    }
  >,
  response: Response,
) {
  const id = Number(request.params.id);
  const { courseIds, templateId, spreadsheetId, name } = request.body;

  if (!isPositiveInt(id)) {
    return response.status(400).send({ error: "Invalid offering id" });
  }
  if (courseIds !== undefined && !isNonEmptyPositiveIntArray(courseIds)) {
    return response.status(400).send({ error: "courseIds must be a non-empty array" });
  }
  if (!isOptionalString(templateId)) {
    return response.status(400).send({ error: "Invalid templateId" });
  }
  if (!isOptionalNullableString(spreadsheetId)) {
    return response.status(400).send({ error: "Invalid spreadsheetId" });
  }
  if (!isOptionalNullableString(name)) {
    return response.status(400).send({ error: "Invalid name" });
  }

  const existing = await prisma.offering.findUnique({
    where: { id },
    include: { offeringCourses: true },
  });
  if (!existing || existing.kind !== "OPTIONAL") {
    return response.status(404).send({ error: "Optional offering not found" });
  }

  let toAdd: number[] = [];
  let toRemove: number[] = [];

  if (courseIds !== undefined) {
    const uniqueCourseIds = [...new Set(courseIds)];
    const courses = await prisma.course.findMany({ where: { id: { in: uniqueCourseIds } } });
    if (courses.length !== uniqueCourseIds.length) {
      return response.status(400).send({ error: "One or more courseIds do not exist" });
    }

    const courseSetError = validateCourseSet(courses, existing.year);
    if (courseSetError) {
      return response.status(400).send(courseSetError);
    }

    const existingCourseIds = existing.offeringCourses.map((oc) => oc.courseId);
    toAdd = uniqueCourseIds.filter((cid) => !existingCourseIds.includes(cid));
    toRemove = existingCourseIds.filter((cid) => !uniqueCourseIds.includes(cid));

    if (toRemove.length) {
      const enrolled = await prisma.studentOffering.findMany({
        where: { offeringId: id, courseId: { in: toRemove } },
        include: { eligible: { include: { course: true } } },
      });
      if (enrolled.length) {
        const names = [...new Set(enrolled.map((e) => e.eligible.course.name))];
        return response.status(409).send({
          error: `Cannot remove courses with enrolled students: ${names.join(", ")}`,
        });
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length) {
      await tx.offeringCourse.deleteMany({ where: { offeringId: id, courseId: { in: toRemove } } });
    }
    if (toAdd.length) {
      await tx.offeringCourse.createMany({
        data: toAdd.map((courseId) => ({ offeringId: id, courseId })),
      });
    }
    const updateData = Object.fromEntries(
      Object.entries({ templateId, spreadsheetId, name }).filter(([, v]) => v !== undefined),
    ) as { templateId?: string; spreadsheetId?: string | null; name?: string | null };
    if (Object.keys(updateData).length) {
      await tx.offering.update({ where: { id }, data: updateData });
    }
  });

  const updated = await prisma.offering.findUniqueOrThrow({
    where: { id },
    include: { subject: true, offeringCourses: { include: { course: true } } },
  });

  const level = levelFromCourses(updated.offeringCourses);
  const totalForLevel = await countCoursesForLevelYear(updated.year, level);
  return response.status(200).send({
    id: updated.id,
    subjectId: updated.subjectId,
    subjectName: updated.subject.name,
    name: updated.name,
    year: updated.year,
    level,
    templateId: updated.templateId,
    spreadsheetId: updated.spreadsheetId,
    displayName: buildDisplayName(
      composeSubjectName(updated.subject.name, updated.name),
      updated.offeringCourses,
      totalForLevel,
    ),
    courses: updated.offeringCourses.map((oc) => ({
      courseId: oc.courseId,
      courseName: oc.course.name,
      division: oc.course.name[3] || "",
    })),
  });
}

export async function deleteOptionalOffering(
  request: Request<{ id: string }>,
  response: Response,
) {
  const id = Number(request.params.id);
  if (!isPositiveInt(id)) {
    return response.status(400).send({ error: "Invalid offering id" });
  }

  const existing = await prisma.offering.findUnique({ where: { id } });
  if (!existing || existing.kind !== "OPTIONAL") {
    return response.status(404).send({ error: "Optional offering not found" });
  }

  const enrolled = await prisma.studentOffering.findFirst({ where: { offeringId: id } });
  if (enrolled) {
    return response.status(409).send({ error: "Cannot delete: students are enrolled in this offering" });
  }

  const revisions = await prisma.revisionRequest.findFirst({ where: { offeringId: id } });
  if (revisions) {
    return response.status(409).send({ error: "Cannot delete: revision requests reference this offering" });
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.offeringTimeSlot.deleteMany({ where: { offeringId: id } });
    await tx.teacherOffering.deleteMany({ where: { offeringId: id } });
    await tx.offeringCourse.deleteMany({ where: { offeringId: id } });
    return tx.offering.delete({ where: { id } });
  });

  return response.status(200).send(deleted);
}
