import { requireSafeId } from './domain.js';

export type ProductionReviewAction = 'approve' | 'cancel';

function grams(value: unknown, label: string, allowZero = false) {
  if (
    typeof value !== 'number' || !Number.isSafeInteger(value) ||
    value < (allowZero ? 0 : 1) || value > 1_000_000_000_000
  ) throw new Error(`${label} phải là số gram nguyên ${allowZero ? 'không âm' : 'dương'} hợp lệ.`);
  return value;
}

export function validateProductionBatchInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu mẻ sản xuất không hợp lệ.');
  const input = value as Record<string, unknown>;
  const inputItemId = requireSafeId(input.inputItemId, 'Mã mặt hàng đầu vào');
  const outputItemId = requireSafeId(input.outputItemId, 'Mã mặt hàng thành phẩm');
  const scrapItemId = input.scrapItemId ? requireSafeId(input.scrapItemId, 'Mã mặt hàng phế phẩm') : '';
  if (inputItemId === outputItemId || (scrapItemId && [inputItemId, outputItemId].includes(scrapItemId))) {
    throw new Error('Mặt hàng đầu vào, thành phẩm và phế phẩm phải khác nhau.');
  }
  const inputGrams = grams(input.inputGrams, 'Khối lượng đầu vào');
  const outputGrams = grams(input.outputGrams, 'Khối lượng thành phẩm');
  const scrapGrams = grams(input.scrapGrams ?? 0, 'Khối lượng phế phẩm', true);
  if (outputGrams + scrapGrams > inputGrams) throw new Error('Thành phẩm và phế phẩm không được vượt đầu vào.');
  if (scrapGrams > 0 && !scrapItemId) throw new Error('Mẻ có phế phẩm phải chọn mặt hàng phế phẩm.');
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 300) throw new Error('Ghi chú mẻ sản xuất quá dài.');
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    batchId: requireSafeId(input.batchId, 'Mã mẻ'),
    machineId: requireSafeId(input.machineId, 'Mã máy'),
    weighTicketId: requireSafeId(input.weighTicketId, 'Mã phiếu cân'),
    inputItemId,
    outputItemId,
    scrapItemId,
    inputGrams,
    outputGrams,
    scrapGrams,
    note,
  };
}

export function productionMetrics(inputGrams: number, outputGrams: number, scrapGrams: number) {
  [inputGrams, outputGrams, scrapGrams].forEach((value) => {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Khối lượng mẻ sản xuất không hợp lệ.');
  });
  if (inputGrams <= 0 || outputGrams <= 0) throw new Error('Đầu vào và thành phẩm phải lớn hơn 0.');
  if (outputGrams + scrapGrams > inputGrams) throw new Error('Thành phẩm và phế phẩm không được vượt đầu vào.');
  const lossGrams = inputGrams - outputGrams - scrapGrams;
  return {
    lossGrams,
    recoveryBasisPoints: Math.round((outputGrams * 10_000) / inputGrams),
    highLoss: lossGrams * 10 > inputGrams,
  };
}

export function validateProductionReviewInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu duyệt mẻ không hợp lệ.');
  const input = value as Record<string, unknown>;
  const action = String(input.action) as ProductionReviewAction;
  if (action !== 'approve' && action !== 'cancel') throw new Error('Thao tác duyệt mẻ không hợp lệ.');
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (action === 'cancel' && reason.length < 3) throw new Error('Hủy mẻ phải có lý do tối thiểu 3 ký tự.');
  if (reason.length > 300) throw new Error('Lý do duyệt mẻ quá dài.');
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    batchId: requireSafeId(input.batchId, 'Mã mẻ'),
    action,
    reason,
  };
}
