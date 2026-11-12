import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareStockMovement, validateStockMovementInput } from './stock.js';

test('backend kho nhập và xuất cập nhật số dư nguyên gram chính xác', () => {
  assert.deepEqual(
    prepareStockMovement({ stockGrams: 10_000, inGrams: 20_000, outGrams: 10_000 }, 'in', 2_500),
    { stockBefore: 10_000, stockAfter: 12_500, inGramsAfter: 22_500, outGramsAfter: 10_000 },
  );
  assert.deepEqual(
    prepareStockMovement({ stockGrams: 10_000, inGrams: 20_000, outGrams: 10_000 }, 'out', 2_500),
    { stockBefore: 10_000, stockAfter: 7_500, inGramsAfter: 20_000, outGramsAfter: 12_500 },
  );
});

test('backend kho chặn xuất vượt tồn và số dư hỏng', () => {
  assert.throws(() => prepareStockMovement({ stockGrams: 1_000, inGrams: 1_000, outGrams: 0 }, 'out', 1_001), /vượt tồn/);
  assert.throws(() => prepareStockMovement({ stockGrams: -1, inGrams: 0, outGrams: 0 }, 'in', 1), /không hợp lệ/);
});

test('backend kho chuẩn hóa input và chặn số kg thập phân không an toàn', () => {
  const input = validateStockMovementInput({
    workshopId: 'du_nhua_01', movementId: 'MOV_001', itemId: 'PET_01', type: 'out', quantityGrams: 1_250,
    sourceType: 'weigh_ticket', sourceId: 'PC_001', note: ' Xuất theo phiếu ',
  });
  assert.equal(input.note, 'Xuất theo phiếu');
  assert.throws(() => validateStockMovementInput({ ...input, quantityGrams: 1.5 }), /số gram nguyên/);
  assert.throws(() => validateStockMovementInput({ ...input, sourceType: 'unknown' }), /chứng từ nguồn/);
});
