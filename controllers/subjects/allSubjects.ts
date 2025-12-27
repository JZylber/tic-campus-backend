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
