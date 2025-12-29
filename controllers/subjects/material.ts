import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData, setCacheHeaders } from "../shared.ts";
import type { MaterialTable } from "../subjectSchema.ts";

type Material = {
  name: string;
  link: string;
  image: string;
  description: string;
  type: string;
};

export async function getSubjectMaterials(
  request: Request<
    { subject: string; course: string; year: string },
    {},
    {},
    { dataSheetId?: string }
  >,
  response: Response
) {
  // Get parameters from request parameters
  const { subject, course, year } = request.params;
  let spreadsheetId = request.query.dataSheetId || "";
  if (!spreadsheetId) {
    try {
      spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
    } catch (error) {
      return response.status(404).send({ error: (error as Error).message });
    }
  }
  const sheets = await getSheetClient();
  const materialPromise = sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Material!A:H",
  });
  const materialRes = await materialPromise;
  const materialData = asTableData(materialRes.data.values!) as MaterialTable;
  // Filter only visible materials and that subject matches
  const visibleMaterialData = materialData.filter(
    (row) => row.Visible.toLowerCase() === "true" && row.Materia === subject
  );
  const materials: Material[] = visibleMaterialData.map((row) => ({
    name: row.Nombre,
    link: row.Link,
    image: row.Imagen,
    description: row.Descripción,
    type: row.Tipo,
  }));
  // Set Cache Control, CDN-Cache-Control and Vercel-CDN-Cache-Control to 200 seconds
  setCacheHeaders(response, 200);
  return response.status(200).send(materials);
}
