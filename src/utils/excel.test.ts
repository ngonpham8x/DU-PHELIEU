import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExcelWorkbook, safeExcelText } from './excel';

test('ExcelJS giữ số ở dạng số và vô hiệu chuỗi giống công thức', async () => {
  const workbook = await buildExcelWorkbook({
    filename: 'test.xlsx',
    subject: 'Kiểm thử',
    sheets: [{
      name: 'Dữ liệu/Test',
      title: 'Bảng kiểm thử',
      columns: [
        { header: 'Tên', key: 'name' },
        { header: 'Số tiền', key: 'amount', numFmt: '#,##0 [$₫-vi-VN]' },
      ],
      rows: [{ name: '=HYPERLINK("bad")', amount: 1250000 }],
    }],
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const ExcelJS = (await import('exceljs')).default;
  const loaded = new ExcelJS.Workbook();
  await loaded.xlsx.load(buffer);
  const sheet = loaded.worksheets[0];
  assert.equal(sheet.name, 'Dữ liệu Test');
  assert.equal(sheet.getCell('A5').value, "'=HYPERLINK(\"bad\")");
  assert.equal(sheet.getCell('B5').value, 1250000);
  assert.equal(sheet.getColumn(2).numFmt, '#,##0 [$₫-vi-VN]');
});

test('safeExcelText loại ký tự điều khiển và bảo vệ tiền tố nguy hiểm', () => {
  assert.equal(safeExcelText('+1+2'), "'+1+2");
  assert.equal(safeExcelText('Tên\u0000 nhân viên'), 'Tên  nhân viên');
});
