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
  // One row per (subject, course) pair. OfferingCourse is exactly that grain,
  // so ordering happens in the DB (same collation as before) — year desc,
  // subject name asc, course name asc.
  const offeringCourses = await prisma.offeringCourse.findMany({
    include: {
      course: true,
      offering: { include: { subject: true } },
    },
    orderBy: [
      { course: { year: "desc" } },
      { offering: { subject: { name: "asc" } } },
      { course: { name: "asc" } },
    ],
  });
  const subjects: Subject[] = offeringCourses.map((oc) => ({
    name: oc.offering.subject.name,
    course: oc.course.name,
    level: Number(oc.course.name[2] || 0),
    division: oc.course.name[3] || "",
    year: oc.course.year,
    template: oc.offering.templateId,
    spreadsheetId: oc.offering.spreadsheetId,
  }));
  return response.status(200).send(subjects);
}

export async function getTemplateSubjects(
  request: Request<{ templateId: string }>,
  response: Response,
) {
  const { templateId } = request.params;
  // Offerings using this template, exploded per course. Object keys are built in
  // the exact legacy Subject column order to keep the response byte-identical.
  const offeringCourses = await prisma.offeringCourse.findMany({
    where: {
      offering: { templateId },
    },
    orderBy: [
      { course: { year: "desc" } },
      { offering: { subject: { name: "asc" } } },
      { course: { name: "asc" } },
    ],
    include: {
      course: true,
      offering: { include: { subject: true } },
    },
  });
  const subjectsQuery = offeringCourses.map((oc) => ({
    id: oc.legacySubjectId,
    name: oc.offering.subject.name,
    spreadsheetId: oc.offering.spreadsheetId,
    templateId: oc.offering.templateId,
    marks: oc.offering.subject.marks,
    courseId: oc.courseId,
    course: oc.course.name,
    year: oc.course.year,
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
  const offeringCourses = await prisma.offeringCourse.findMany({
    where: {
      offering: {
        teacherOfferings: {
          some: {
            teacherId: teacherId,
          },
        },
      },
    },
    orderBy: { legacySubjectId: "asc" },
    select: {
      course: {
        select: {
          name: true,
          year: true,
        },
      },
      offering: {
        select: {
          spreadsheetId: true,
          subject: { select: { name: true } },
        },
      },
    },
  });
  const flattenedSubjects = offeringCourses.map((oc) => ({
    name: oc.offering.subject.name,
    course: oc.course.name,
    year: oc.course.year,
    dataSheetId: oc.offering.spreadsheetId,
  }));
  return response.status(200).send(flattenedSubjects);
}
