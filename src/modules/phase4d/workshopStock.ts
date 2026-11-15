export type StockDirection = 'in' | 'out';

export interface ManualStockMovement {
  workshopId: string;
  movementId: string;
  itemId: string;
  type: StockDirection;
  quantityGrams: number;
  sourceType: 'manual';
  sourceId: string;
  note: string;
}

export interface WorkshopInventoryItem {
  id: string;
  code: string;
  name: string;
  stockGrams: number;
  openingGrams?: number;
  inGrams: number;
  outGrams: number;
  inactive: boolean;
}

export function isWorkshopId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{2,64}$/.test(value);
}

function isGramCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function stockHistoryDateBounds(from: string, through: string): { start: Date | null; end: Date | null } {
  function startOfDay(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-02' || value > '9999-12-30') {
      throw new Error('Ngày lọc không hợp lệ.');
    }
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error('Ngày lọc không hợp lệ.');
    // Use Vietnam business dates (UTC+07), independent of the browser timezone.
    return date.getTime() - 7 * 60 * 60 * 1000;
  }

  const start = from ? startOfDay(from) : null;
  const last = through ? startOfDay(through) : null;
  if (start !== null && last !== null && start > last) throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.');
  return { start: start === null ? null : new Date(start), end: last === null ? null : new Date(last + 24 * 60 * 60 * 1000) };
}

export function parseStockKilograms(value: string, { allowZero = false } = {}): number {
  const text = value.trim();
  if (!/^\d+(?:[,.]\d{1,3})?$/.test(text)) {
    throw new Error('Nhập khối lượng theo kg, tối đa 3 chữ số thập phân.');
  }
  const grams = Math.round(Number(text.replace(',', '.')) * 1000);
  if (!Number.isSafeInteger(grams) || grams < (allowZero ? 0 : 1) || grams > 1_000_000_000_000) {
    throw new Error(allowZero ? 'Tồn đầu phải từ 0 đến 1 tỷ kg.' : 'Khối lượng phải lớn hơn 0 và tối đa 1 tỷ kg.');
  }
  return grams;
}

export function readWorkshopInventoryItem(id: string, workshopId: string, data: Record<string, unknown>): WorkshopInventoryItem | null {
  const { stockGrams, inGrams = 0, outGrams = 0, code, name } = data;
  if (!isWorkshopId(id) || data.id !== id || data.workshopId !== workshopId ||
    (data.unit !== undefined && data.unit !== 'kg') ||
    !isGramCount(stockGrams) || !isGramCount(inGrams) || !isGramCount(outGrams)) return null;

  return {
    id,
    code: typeof code === 'string' && code.trim() ? code : id,
    name: typeof name === 'string' && name.trim() ? name : id,
    stockGrams, inGrams, outGrams,
    openingGrams: isGramCount(data.openingGrams) ? data.openingGrams : undefined,
    inactive: data.status === 'inactive',
  };
}

export function readPendingStockMovement(raw: string | null, workshopId: string): ManualStockMovement | null {
  if (!raw) return null;
  try {
    const movement = JSON.parse(raw) as Partial<ManualStockMovement> | null;
    if (movement?.workshopId !== workshopId || !isWorkshopId(movement.movementId) ||
      !isWorkshopId(movement.itemId) || (movement.type !== 'in' && movement.type !== 'out') ||
      movement.sourceType !== 'manual' || movement.sourceId !== movement.movementId ||
      !isGramCount(movement.quantityGrams) || movement.quantityGrams === 0 || movement.quantityGrams > 1_000_000_000_000 ||
      typeof movement.note !== 'string' || movement.note.length > 300) return null;

    return {
      workshopId, movementId: movement.movementId, itemId: movement.itemId, type: movement.type,
      quantityGrams: movement.quantityGrams, sourceType: 'manual', sourceId: movement.movementId, note: movement.note,
    };
  } catch {
    return null;
  }
}
