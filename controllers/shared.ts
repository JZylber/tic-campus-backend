import type { Response } from "express";

export function getColumnIndex(columnName: string, headers: string[]): number {
  const index = headers.indexOf(columnName);
  if (index === -1) {
    throw new Error(`Column "${columnName}" not found in headers.`);
  }
  return index;
}

export function asTableData(
  rows: string[][]
): Array<{ [key: string]: string }> {
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: { [key: string]: string } = {};
    headers!.forEach((header, index) => {
      obj[header] = row[index]!;
    });
    return obj;
  });
}

export function setCacheHeaders(response: Response, durationInSeconds: number) {
  // Set Cache Control, CDN-Cache-Control and Vercel-CDN-Cache-Control to duration
  const cacheValue = `public, max-age=${durationInSeconds}, s-maxage=${durationInSeconds}, stale-while-revalidate=${durationInSeconds}`;
  response.setHeader("Cache-Control", cacheValue);
  response.setHeader("CDN-Cache-Control", cacheValue);
  response.setHeader("Vercel-CDN-Cache-Control", cacheValue);
}
