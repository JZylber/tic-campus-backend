import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";
import type {
  CourseTable,
  SubjectTable,
  SubjectXCourseTable,
} from "../subjectSchema.ts";

export async function getHomeLinks(
  request: Request<{ subject: string; course: string; year: string }>,
  response: Response,
) {
  // Get parameters from request parameters
  const { subject, course, year } = request.params;
  let spreadsheetId = "";
  try {
    spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
  } catch (error) {
    return response.status(404).send({ error: (error as Error).message });
  }
  const sheets = await getSheetClient();
  const APIrequest = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Curso!A:D", "Materia!A:G"],
  });
  const [courseTable, subjectTable] = APIrequest.data.valueRanges!;
  const courseData = asTableData(courseTable!.values!) as CourseTable;
  const subjectData = asTableData(subjectTable!.values!) as SubjectTable;
  // Presentation link from subject data
  const presentationLink = subjectData.find(
    (s) => s.Materia === subject,
  )?.Presentación;
  let groupLink = "";
  // Check if multicourse by checking if "Link Grupo" exists in courseData
  const isMulticourse = !courseData[0]!.hasOwnProperty("Link Grupo");
  if (isMulticourse) {
    // If multicourse, get the sheet MateriaXCurso!A:D to find the group link
    const subjectXCourseTable = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "MateriaXCurso!A:D",
    });
    const subjectXCourseData = asTableData(
      subjectXCourseTable.data.values!,
    ) as SubjectXCourseTable;
    groupLink = subjectXCourseData.find(
      (sc) => sc.Materia === subject && sc.Curso === course,
    )?.["Link Grupo"]!;
  } else {
    // Get group link from course data. Materia is the same as subject in course data, and the last two letters of course is the "Nombre" column in course data
    groupLink = courseData.find(
      (c) => c.Materia === subject && c.Nombre === course.slice(-2),
    )?.["Link Grupo"]!;
  }
  return response
    .status(200)
    .send({ group: groupLink, presentation: presentationLink });
}

export async function getRedoLinks(
  request: Request<{ subject: string; course: string; year: string }>,
  response: Response,
) {
  // Get parameters from request parameters
  const { subject, course, year } = request.params;
  let spreadsheetId = "";
  try {
    spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
  } catch (error) {
    return response.status(404).send({ error: (error as Error).message });
  }
  const sheets = await getSheetClient();
  const subjectTable = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Materia!A:G",
  });
  const subjectData = asTableData(subjectTable.data.values!) as SubjectTable;
  // Get redo links from subject data
  const redoActivitiesLink = subjectData.find((s) => s.Materia === subject)?.[
    "Reentrega Actividades"
  ];
  const redoTPsLink = subjectData.find((s) => s.Materia === subject)?.[
    "Reentrega TPs"
  ];
  return response
    .status(200)
    .send({ activities: redoActivitiesLink, markedActivities: redoTPsLink });
}
