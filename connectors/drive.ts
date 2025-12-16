import path from "node:path";
import process from "node:process";
import { authenticate } from "@google-cloud/local-auth";
import { google } from "googleapis";

type SpreadsheetIdInformation = {
  subject: string;
  course: string;
  year: number;
  spreadsheetId: string;
};

let spreadsheetIds: SpreadsheetIdInformation[] = [];

// The scope for reading file metadata.
const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];
const SHEETS_SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"];
// The path to the credentials file.
const CREDENTIALS_PATH = path.join(process.cwd(), "credentials.json");

export async function getDriveClient() {
  // Authenticate with Google and get an authorized client.
  const auth = await authenticate({
    scopes: DRIVE_SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  // Create a new Drive API client.
  const drive = google.drive({ version: "v3", auth });
  return drive;
}

export async function getSheetClient() {
  // Authenticate with Google and get an authorized client.
  const auth = await authenticate({
    scopes: SHEETS_SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });

  // Create a new Sheets API client.
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function updateSpreadsheetIds() {
  const sheets = await getSheetClient();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.MAIN_SPREADSHEET_ID!,
    range: "Datos!A:D",
  });
  spreadsheetIds = res.data.values?.map((row) => ({
    subject: row[0],
    course: row[1],
    year: Number(row[2]),
    spreadsheetId: row[3],
  })) as SpreadsheetIdInformation[];
  return spreadsheetIds;
}

export async function getSpreadsheetId(
  subject: string,
  course: string,
  year: number
) {
  // Find the spreadsheet ID in the cached list.
  let info = spreadsheetIds.find(
    (info) =>
      info.subject === subject && info.course === course && info.year === year
  );

  // If not found, update the cached list and try again.
  if (!info) {
    await updateSpreadsheetIds();
    info = spreadsheetIds.find(
      (info) =>
        info.subject === subject && info.course === course && info.year === year
    );
  }
  // Throw an error if still not found.
  if (!info) {
    throw new Error(
      `Spreadsheet ID not found for ${subject} ${course} ${year}`
    );
  }
  return info.spreadsheetId;
}
