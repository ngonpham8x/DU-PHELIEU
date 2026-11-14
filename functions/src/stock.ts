import { requireSafeId } from './domain.js';

export type StockMovementType = 'in' | 'out';
export type StockSourceType = 'manual' | 'weigh_ticket' | 'production_batch' | 'inventory_adjustment';

const SOURCE_TYPES: StockSourceType[] = ['manual', 'weigh_ticket', 'production_batch', 'inventory_adjustment'];

export function validateOpeningStockInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu tồn đầu không hợp lệ.');
  const input = value as Record<string, unknown>;
  const code = requireSafeId(input.code, 'Mã mặt hàng').toUpperCase();
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
  if (code.length > 40) throw new Error('Mã mặt hàng tối đa 40 ký tự.');
  if (name.length < 2 || name.length > 120) throw new Error('Tên mặt hàng phải từ 2 đến 120 ký tự.');
  if (reference.length < 3 || reference.length > 300) throw new Error('Nhập số biên bản hoặc căn cứ kiểm kê từ 3 đến 300 ký tự.');
  if (typeof input.openingGrams !== 'number' || !Number.isSafeInteger(input.openingGrams) || input.openingGrams < 0 || input.openingGrams > 1_000_000_000_000) {
    throw new Error('Tồn đầu phải là số gram nguyên không âm và hợp lệ.');
  }
  return { workshopId: requireSafeId(input.workshopId, 'Mã xưởng'), code, name, reference, openingGrams: input.openingGrams };
}

export function validateStockMovementInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Dữ liệu biến động kho không hợp lệ.');
  const input = value as Record<string, unknown>;
  const type = String(input.type) as StockMovementType;
  if (type !== 'in' && type !== 'out') throw new Error('Loại biến động kho không hợp lệ.');
  const sourceType = String(input.sourceType) as StockSourceType;
  if (!SOURCE_TYPES.includes(sourceType)) throw new Error('Loại chứng từ nguồn không hợp lệ.');
  if (typeof input.quantityGrams !== 'number' || !Number.isSafeInteger(input.quantityGrams) || input.quantityGrams <= 0 || input.quantityGrams > 1_000_000_000_000) {
    throw new Error('Khối lượng phải là số gram nguyên dương hợp lệ.');
  }
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 300) throw new Error('Ghi chú biến động kho quá dài.');
  return {
    workshopId: requireSafeId(input.workshopId, 'Mã xưởng'),
    movementId: requireSafeId(input.movementId, 'Mã biến động'),
    itemId: requireSafeId(input.itemId, 'Mã mặt hàng'),
    type,
    quantityGrams: input.quantityGrams,
    sourceType,
    sourceId: requireSafeId(input.sourceId, 'Mã chứng từ nguồn'),
    note,
  };
}

export function prepareStockMovement(item: Record<string, unknown>, type: StockMovementType, quantityGrams: number) {
  const stockGrams = item.stockGrams;
  const inGrams = item.inGrams ?? 0;
  const outGrams = item.outGrams ?? 0;
  for (const [label, value] of [['tồn', stockGrams], ['tổng nhập', inGrams], ['tổng xuất', outGrams]] as const) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error(`Số ${label} kho không hợp lệ.`);
  }
  const currentStock = stockGrams as number;
  const currentIn = inGrams as number;
  const currentOut = outGrams as number;
  if (!Number.isSafeInteger(quantityGrams) || quantityGrams <= 0) throw new Error('Khối lượng biến động không hợp lệ.');
  if (type === 'out' && quantityGrams > currentStock) throw new Error('Không thể xuất vượt tồn kho hiện tại.');
  const stockAfter = type === 'in' ? currentStock + quantityGrams : currentStock - quantityGrams;
  const inGramsAfter = type === 'in' ? currentIn + quantityGrams : currentIn;
  const outGramsAfter = type === 'out' ? currentOut + quantityGrams : currentOut;
  if (![stockAfter, inGramsAfter, outGramsAfter].every(Number.isSafeInteger)) {
    throw new Error('Số liệu kho sau giao dịch vượt giới hạn an toàn.');
  }
  return {
    stockBefore: currentStock,
    stockAfter,
    inGramsAfter,
    outGramsAfter,
  };
}
