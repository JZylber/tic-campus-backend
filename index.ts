import express, { type Request, type Response } from "express";
import dotenv from "dotenv";
import { getSheetClient, getSpreadsheetId } from "./connectors/drive.ts";

// configures dotenv to work in your application
dotenv.config();
const app = express();

const PORT = process.env.PORT;

app.get("/", async (request: Request, response: Response) => {
  const sId = await getSpreadsheetId(
    "Desarollo de Aplicaciones Informáticas",
    "NR5A",
    2025
  );
  response.status(200).send(`Spreadsheet ID: ${sId}`);
});

app
  .listen(PORT, () => {
    console.log("Server running at PORT: ", PORT);
  })
  .on("error", (error) => {
    // gracefully handle error
    throw new Error(error.message);
  });
