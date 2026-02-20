import process from "node:process";
import { google } from "googleapis";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../index.ts";

interface SpreadsheetIdInformation {
  subject: string;
  course: string;
  year: number;
  spreadsheetId: string;
}

export async function setGoogleCredentials() {
  const keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  // See if file already exists
  try {
    if (keyFilename) {
      await fs.access(keyFilename);
      return;
    }
  } catch {
    // File does not exist, will create it
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64 && keyFilename) {
      // Decode the base64 credentials
      const credentialsJson = Buffer.from(
        process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64,
        "base64",
      ).toString("utf-8");

      // Ensure the /tmp directory exists
      await fs.mkdir(path.dirname(keyFilename), { recursive: true });
      // Write the credentials file to the temporary directory
      await fs.writeFile(keyFilename, credentialsJson, "utf-8");
    }
  }
}

export async function getDriveClient() {
  await setGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  // Create a new Drive API client.
  const drive = google.drive({ version: "v3", auth });
  return drive;
}

export async function getSheetClient() {
  await setGoogleCredentials();
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  // Create a new Sheets API client.
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

export async function getSpreadsheetId(
  subject: string,
  course: string,
  year: number,
) {
  const spreadsheetId = await prisma.subject.findFirst({
    where: {
      name: subject,
      course,
      year,
    },
    select: {
      spreadsheet: true,
    },
  });
  if (!spreadsheetId || !spreadsheetId.spreadsheet) {
    throw new Error(
      "Spreadsheet ID not found for the given subject, course and year",
    );
  }
  return spreadsheetId.spreadsheet;
}
