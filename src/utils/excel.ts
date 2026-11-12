export type ExcelCellValue = string | number | boolean | Date | null | undefined;

export type ExcelColumn = {
  header: string;
  key: string;
  width?: number;
  numFmt?: string;
};

export type ExcelSheet = {
  name: string;
  title: string;
  subtitle?: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, ExcelCellValue>>;
};

export type ExcelWorkbookSpec = {
  filename: string;
  subject: string;
  sheets: ExcelSheet[];
};

export function safeExcelText(value: string) {
  const cleaned = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ').trim();
  return /^[=+@\-\t\r]/.test(cleaned) ? `'${cleaned}` : cleaned;
}

function safeWorksheetName(value: string, fallback: string) {
  const cleaned = value.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31);
  return cleaned || fallback;
}

function normalizeValue(value: ExcelCellValue) {
  return typeof value === 'string' ? safeExcelText(value) : value ?? '';
}

export async function buildExcelWorkbook(spec: ExcelWorkbookSpec) {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dư-Nhựa phế liệu';
  workbook.company = 'Xưởng phân loại & băm nhựa';
  workbook.subject = spec.subject;
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  spec.sheets.forEach((sheetSpec, sheetIndex) => {
    const worksheet = workbook.addWorksheet(safeWorksheetName(sheetSpec.name, `Sheet ${sheetIndex + 1}`), {
      views: [{ state: 'frozen', ySplit: 4 }],
      properties: { defaultRowHeight: 20 },
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    });
    const lastColumn = Math.max(1, sheetSpec.columns.length);

    worksheet.mergeCells(1, 1, 1, lastColumn);
    const titleCell = worksheet.getCell(1, 1);
    titleCell.value = safeExcelText(sheetSpec.title);
    titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2942' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 30;

    worksheet.mergeCells(2, 1, 2, lastColumn);
    const subtitleCell = worksheet.getCell(2, 1);
    subtitleCell.value = safeExcelText(sheetSpec.subtitle || `Xuất lúc ${new Date().toLocaleString('vi-VN')}`);
    subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF334155' } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    const headerRowNumber = 4;
    const headerRow = worksheet.getRow(headerRowNumber);
    headerRow.values = sheetSpec.columns.map((column) => column.header);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    headerRow.height = 28;

    sheetSpec.columns.forEach((column, index) => {
      const excelColumn = worksheet.getColumn(index + 1);
      excelColumn.width = Math.min(60, Math.max(10, column.width || column.header.length + 4));
      if (column.numFmt) excelColumn.numFmt = column.numFmt;
    });

    sheetSpec.rows.forEach((data, rowIndex) => {
      const row = worksheet.addRow(sheetSpec.columns.map((column) => normalizeValue(data[column.key])));
      row.alignment = { vertical: 'top', wrapText: true };
      if (rowIndex % 2 === 1) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
      row.eachCell((cell) => {
        cell.border = {
          bottom: { style: 'hair', color: { argb: 'FFCBD5E1' } },
        };
      });
    });

    if (sheetSpec.columns.length > 0) {
      worksheet.autoFilter = {
        from: { row: headerRowNumber, column: 1 },
        to: { row: Math.max(headerRowNumber, headerRowNumber + sheetSpec.rows.length), column: sheetSpec.columns.length },
      };
    }
    worksheet.headerFooter.oddFooter = '&L Dư-Nhựa phế liệu&CTrang &P / &N&R&D &T';
  });

  return workbook;
}

export async function exportExcelWorkbook(spec: ExcelWorkbookSpec) {
  const workbook = await buildExcelWorkbook(spec);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = spec.filename.endsWith('.xlsx') ? spec.filename : `${spec.filename}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
