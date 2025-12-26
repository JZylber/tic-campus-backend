import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";

type CourseTable = Array<{
  Id: string;
  Nombre: string;
  "Link Grupo"?: string;
  Materia: string;
}>;

type SubjectTable = Array<{
  Id: string;
  Materia: string;
  Presentación: string;
  "Reentrega Actividades": string;
  "Reentrega TPs": string;
  "Proporción TPS/Nota": string;
  "Actividades Especiales": string;
}>;

type SubjectXCourseTable = Array<{
  Id: string;
  Curso: string;
  "Link Grupo": string;
  Materia: string;
}>;

export async function getHomeLinks(
  request: Request<{ subject: string; course: string; year: string }>,
  response: Response
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
  const [courseTable, subjectTable] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Curso!A:D",
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Materia!A:G",
    }),
  ]);
  const courseData = asTableData(courseTable.data.values!) as CourseTable;
  const subjectData = asTableData(subjectTable.data.values!) as SubjectTable;
  // Presentation link from subject data
  const presentationLink = subjectData.find(
    (s) => s.Materia === subject
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
      subjectXCourseTable.data.values!
    ) as SubjectXCourseTable;
    groupLink = subjectXCourseData.find(
      (sc) => sc.Materia === subject && sc.Curso === course
    )?.["Link Grupo"]!;
  } else {
    // Get group link from course data
    groupLink = courseData.find((c) => c.Materia === subject)?.["Link Grupo"]!;
  }
  return response
    .status(200)
    .send({ group: groupLink, presentation: presentationLink });
}
