export function getColumnIndex(columnName: string, headers: string[]): number {
  const index = headers.indexOf(columnName);
  if (index === -1) {
    throw new Error(`Column "${columnName}" not found in headers.`);
  }
  return index;
}
