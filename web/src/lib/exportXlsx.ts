import * as XLSX from 'xlsx'

export function exportToXlsx(filename: string, sheetName: string, rows: Record<string, string | number>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}
