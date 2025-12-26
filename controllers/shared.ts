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
