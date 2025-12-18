import process from "node:process";
import { google } from "googleapis";
import { promises as fs } from "fs";
import path from "path";

let spreadsheetIds: SpreadsheetIdInformation[] = [];

interface SpreadsheetIdInformation {
  subject: string;
  course: string;
  year: number;
  spreadsheetId: string;
}

export async function setGoogleCredentials() {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (process.env.GOOGLE_CREDENTIALS_BASE64 && keyFilename) {
    // Decode the base64 credentials
    const credentialsJson = Buffer.from(
      process.env.GOOGLE_CREDENTIALS_BASE64,
      "base64"
    ).toString("utf-8");

    // Ensure the /tmp directory exists
    await fs.mkdir(path.dirname(keyFilename), { recursive: true });

    // Write the credentials file to the temporary directory
    await fs.writeFile(keyFilename, credentialsJson, "utf-8");
  }
}

export async function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  // Create a new Drive API client.
  const drive = google.drive({ version: "v3", auth });
  return drive;
}

export async function getSheetClient() {
  // Authenticate with Google and get an authorized client.
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
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
