import type { Request, Response } from "express";
import { getSheetClient, getSpreadsheetId } from "../../connectors/google.ts";
import { asTableData } from "../shared.ts";
import type { EventTable, ScheduleTable } from "../subjectSchema.ts";

type ScheduleEntry = {
  subject: string;
  course: string;
  day: string;
  block: string;
  teacher: string;
  classroom: string;
};

type EventEntry = {
  title: string;
  date: Date;
  block: string;
  course: string;
  classroom: string | undefined;
};

type GroupEntry = {
  course: string;
  events: EventEntry[];
  schedule: ScheduleEntry[];
};

export async function getCalendar(
  request: Request<
    { subject: string; course: string; year: string },
    {},
    {},
    { datasheetId?: string }
  >,
  response: Response,
) {
  // Get parameters from request parameters
  const { subject, course, year } = request.params;
  let spreadsheetId = request.query.datasheetId || "";
  if (!spreadsheetId) {
    try {
      spreadsheetId = await getSpreadsheetId(subject, course, Number(year));
    } catch (error) {
      return response.status(404).send({ error: (error as Error).message });
    }
  }
  const sheets = await getSheetClient();
  const APIrequest = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Horario 1C!A:F", "Eventos!A:E"],
  });
  const [scheduleResponse, eventsResponse] = APIrequest.data.valueRanges || [];
  const schedule = asTableData(scheduleResponse?.values || []) as ScheduleTable;
  const events = asTableData(eventsResponse?.values || []) as EventTable;
  // Create group entry for each course, with schedule and events
  const groupEntries: GroupEntry[] = [];
  schedule.forEach((entry) => {
    let group = groupEntries.find((g) => g.course === entry.TICurso);
    if (!group) {
      group = { course: entry.TICurso, events: [], schedule: [] };
      groupEntries.push(group);
    }
    group.schedule.push({
      subject: entry.Materia,
      course: entry.TICurso,
      day: entry.Día,
      block: entry.Bloque,
      teacher: entry.Profe,
      classroom: entry.Ámbito,
    });
  });
  events.forEach((entry) => {
    let entryGroups = entry.Grupo.split(",").map((g) => g.trim());
    let groups = groupEntries.filter((g) => entryGroups.includes(g.course));
    groups.forEach((group) => {
      const [day, month, year] = entry.Fecha.split("/").map((part) =>
        parseInt(part),
      );
      group.events.push({
        title: entry.Nombre,
        date: new Date(year!, month! - 1, day),
        block: entry.Bloque,
        course: group.course,
        classroom: entry.Ámbito,
      });
    });
  });
  return response.status(200).send(groupEntries);
}
