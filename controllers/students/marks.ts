import type { Request, Response } from "express";
import { getSheetClient } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";

export async function getStudentMarks(request: Request, response: Response) {}
