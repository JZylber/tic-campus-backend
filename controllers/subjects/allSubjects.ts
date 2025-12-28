import type { Request, Response } from "express";
import { getSheetClient } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";

type SubjectTemplateTable = Array<{
  Materia: string;
  Curso: string;
  Año: string;
  "Spreadsheet ID": string;
  "Id Template": string;
}>;

type Subject = {
  name: string;
  course: string;
  level: number;
  division: string;
  year: number;
};

export async function getAllSubjects(request: Request, response: Response) {
  const sheetsAPI = await getSheetClient();
  const subjectTemplatePromise = sheetsAPI.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "Datos!A:E",
  });
  const subjectTemplateRes = await subjectTemplatePromise;
  const subjectTemplateData = asTableData(
    subjectTemplateRes.data.values!
  ) as SubjectTemplateTable;
  // Filter out subjects with incomplete data
  const filteredSubjectData = subjectTemplateData.filter(
    (row) =>
      row.Materia &&
      row.Curso &&
      row.Año &&
      row["Spreadsheet ID"] &&
      row["Id Template"]
  );
  // Level is derived from Curso: "NR3A" -> 3, "NR5C" -> 5, etc.
  // Division is derived from Curso: "NR3A" -> "A", "NR5C" -> "C", but can be empty if not present NR3 -> ""
  const subjects: Subject[] = filteredSubjectData.map((row) => ({
    name: row.Materia,
    course: row.Curso,
    level: Number(row.Curso.match(/\d+/)?.[0] || 0),
    division: row.Curso.match(/\d+([A-Za-z]*)/)?.[1] || "",
    year: Number(row.Año),
  }));
  return response.status(200).send(subjects);
}

export async function getTemplateSubjects(
  request: Request<{ templateId: string }>,
  response: Response
) {
  const { templateId } = request.params;
  const sheetsAPI = await getSheetClient();
  const subjectTemplatePromise = sheetsAPI.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "Datos!A:E",
  });
  const subjectTemplateRes = await subjectTemplatePromise;
  const subjectTemplateData = asTableData(
    subjectTemplateRes.data.values!
  ) as SubjectTemplateTable;
  const filteredSubjects = subjectTemplateData.filter(
    (row) => row["Id Template"] === templateId
  );
  return response.status(200).send(filteredSubjects);
}
