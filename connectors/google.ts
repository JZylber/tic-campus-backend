import process from "node:process";
import { google } from "googleapis";
import { promises as fs } from "fs";
import path from "path";
import prisma from "../prisma/prisma.ts";

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
  // Resolve the Offering for this subject on the given course/year.
  // (Post-refactor: an Offering can span multiple courses via OfferingCourse.)
  const spreadsheetId = await prisma.offering.findFirst({
    where: {
      subject: {
        name: subject,
      },
      offeringCourses: {
        some: {
          course: {
            name: course,
            year,
          },
        },
      },
    },
    select: {
      spreadsheetId: true,
    },
  });
  if (!spreadsheetId || !spreadsheetId.spreadsheetId) {
    throw new Error(
      "Spreadsheet ID not found for the given subject, course and year",
    );
  }
  return spreadsheetId.spreadsheetId;
}

// Resolves the Offering itself (not just its spreadsheetId) for a
// subject/course/year, optionally disambiguated by a known spreadsheetId
// (multiple offerings of the same subject on the same course, e.g. two
// optional variants, are told apart by dataSheetId). Callers use `kind` to
// decide whether the offering's roster is the whole course (MANDATORY) or
// just its StudentOffering enrollees (OPTIONAL).
export async function resolveOffering(
  subject: string,
  course: string,
  year: number,
  spreadsheetId?: string,
) {
  return prisma.offering.findFirst({
    where: {
      subject: { name: subject },
      offeringCourses: { some: { course: { name: course, year } } },
      ...(spreadsheetId ? { spreadsheetId } : {}),
    },
    select: { id: true, kind: true, spreadsheetId: true },
  });
}
