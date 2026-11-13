import test from 'node:test';
import assert from 'node:assert/strict';
import { productionMetrics, validateProductionBatchInput, validateProductionReviewInput } from './production.js';

const valid = {
  workshopId: 'du_nhua_01', batchId: 'BATCH_001', machineId: 'MAY_01', weighTicketId: 'PC_001',
  inputItemId: 'PET_RAW', outputItemId: 'PET_FLAKE', scrapItemId: 'SCRAP',
  inputGrams: 1_000_000, outputGrams: 850_000, scrapGrams: 50_000, note: 'Mẻ ca sáng',
};

test('backend sản xuất tính hao hụt và tỷ lệ thu hồi theo số nguyên', () => {
  assert.deepEqual(productionMetrics(1_000_000, 850_000, 50_000), {
    lossGrams: 100_000, recoveryBasisPoints: 8_500, highLoss: false,
  });
});

test('backend sản xuất chặn đầu ra vượt đầu vào và mặt hàng trùng nhau', () => {
  assert.throws(() => validateProductionBatchInput({ ...valid, outputGrams: 980_000, scrapGrams: 50_001 }), /vượt đầu vào/);
  assert.throws(() => validateProductionBatchInput({ ...valid, outputItemId: valid.inputItemId }), /phải khác nhau/);
  assert.throws(() => validateProductionBatchInput({ ...valid, scrapItemId: '', scrapGrams: 1 }), /phải chọn/);
});

test('backend sản xuất kiểm tra thao tác duyệt và bắt buộc lý do hủy', () => {
  assert.equal(validateProductionReviewInput({ workshopId: 'du_nhua_01', batchId: 'BATCH_001', action: 'approve' }).action, 'approve');
  assert.throws(() => validateProductionReviewInput({ workshopId: 'du_nhua_01', batchId: 'BATCH_001', action: 'cancel', reason: 'x' }), /lý do/);
});
