import { useEffect, useState, type FormEvent } from 'react';
import { collection, limit, onSnapshot, orderBy, query, Timestamp, where, type QueryConstraint } from 'firebase/firestore';
import { workshopDb } from '../../lib/firebase';
import { exportExcelWorkbook } from '../../utils/excel';
import { stockHistoryDateBounds, isWorkshopId, type WorkshopInventoryItem } from './workshopStock';

type Filters = { from: string; through: string; itemId: string };
type HistoryRow = { id: string; itemId: string; type: string; quantityKg: number; beforeKg: number; afterKg: number; date: string; note: string };
type HistoryState = { rows: HistoryRow[]; omitted: number; overLimit: boolean };

const emptyFilters: Filters = { from: '', through: '', itemId: '' };
const pageSize = 50;
const reportLimit = 1000;
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const fieldClass = 'mt-1 min-h-10 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';
const buttonClass = 'min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-50 dark:border-slate-700';

function readHistoryRow(id: string, workshopId: string, data: Record<string, unknown>): HistoryRow | null {
  const { type, itemId, createdAt, note, quantityGrams, stockBefore, stockAfter } = data;
  const opening = data.sourceType === 'opening_balance';
  if (data.workshopId !== workshopId || (type !== 'in' && type !== 'out') || !isWorkshopId(itemId) ||
    !(createdAt instanceof Timestamp) || typeof quantityGrams !== 'number' || !Number.isSafeInteger(quantityGrams) ||
    quantityGrams < (opening ? 0 : 1) || typeof stockBefore !== 'number' || !Number.isSafeInteger(stockBefore) || stockBefore < 0 ||
    typeof stockAfter !== 'number' || !Number.isSafeInteger(stockAfter) || stockAfter < 0) return null;
  return { id, itemId, type: opening ? 'Tồn đầu' : type === 'in' ? 'Nhập' : 'Xuất', date: dateFormat.format(createdAt.toDate()),
    quantityKg: quantityGrams / 1000, beforeKg: stockBefore / 1000, afterKg: stockAfter / 1000, note: typeof note === 'string' ? note : '' };
}

export function WorkshopStockHistory({ workshopId, items }: { workshopId: string; items: WorkshopInventoryItem[] }) {
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [visible, setVisible] = useState(pageSize);
  const [filterError, setFilterError] = useState('');
  const [readError, setReadError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const filtered = Boolean(filters.from || filters.through || filters.itemId);
  const itemCodes = new Map(items.map((item) => [item.id, item.code]));
  const context = filtered
    ? [filters.from && `Từ ${filters.from}`, filters.through && `Đến ${filters.through}`, filters.itemId && `Mặt hàng ${itemCodes.get(filters.itemId) ?? filters.itemId}`].filter(Boolean).join(' · ')
    : '50 biến động gần nhất';

  useEffect(() => {
    const { start, end } = stockHistoryDateBounds(filters.from, filters.through);
    const constraints: QueryConstraint[] = [orderBy('createdAt', 'desc')];
    if (filters.itemId) constraints.push(where('itemId', '==', filters.itemId));
    if (start) constraints.push(where('createdAt', '>=', start));
    if (end) constraints.push(where('createdAt', '<', end));
    constraints.push(limit(filtered ? reportLimit + 1 : pageSize));

    return onSnapshot(query(collection(workshopDb, 'workshops', workshopId, 'stock_movements'), ...constraints),
      { includeMetadataChanges: true }, (snapshot) => {
        setReadError('');
        if (snapshot.metadata.fromCache) { setHistory(null); return; }
        const docs = snapshot.docs.slice(0, filtered ? reportLimit : pageSize);
        const rows = docs.flatMap((entry) => {
          const row = readHistoryRow(entry.id, workshopId, entry.data());
          return row ? [row] : [];
        });
        setHistory({ rows, omitted: docs.length - rows.length, overLimit: filtered && snapshot.size > reportLimit });
      }, (error) => {
        setHistory(null);
        setReadError(error.code === 'failed-precondition'
          ? 'Bộ lọc chưa sẵn sàng. Quản trị viên cần kiểm tra chỉ mục lịch sử kho trong Firebase.'
          : 'Không thể tải lịch sử kho. Kiểm tra kết nối hoặc quyền truy cập rồi thử lại.');
      });
  }, [workshopId, filters, filtered, attempt]);

  function apply(next: Filters) {
    setFilterError('');
    setReadError('');
    setExportError('');
    setHistory(null);
    setVisible(pageSize);
    setFilters({ ...next });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      stockHistoryDateBounds(draft.from, draft.through);
      apply(draft);
    } catch (error) {
      setFilterError(error instanceof Error ? error.message : 'Khoảng ngày không hợp lệ.');
    }
  }

  async function download() {
    if (!history?.rows.length || history.omitted || history.overLimit || exporting) return;
    setExporting(true);
    setExportError('');
    try {
      await exportExcelWorkbook({
        filename: `Lich_su_kho_${workshopId}.xlsx`, subject: 'Lịch sử nhập – xuất kho',
        sheets: [{
          name: 'Lịch sử kho', title: 'LỊCH SỬ NHẬP – XUẤT KHO', subtitle: `Xưởng ${workshopId} · ${context} · Giờ Việt Nam`,
          columns: [
            { header: 'Thời gian', key: 'date', width: 24 }, { header: 'Mã phiếu', key: 'id', width: 42 },
            { header: 'Mặt hàng', key: 'itemCode', width: 24 }, { header: 'Loại', key: 'type' },
            { header: 'Số lượng (kg)', key: 'quantityKg', numFmt: '#,##0.###' },
            { header: 'Tồn trước (kg)', key: 'beforeKg', numFmt: '#,##0.###' },
            { header: 'Tồn sau (kg)', key: 'afterKg', numFmt: '#,##0.###' }, { header: 'Ghi chú', key: 'note', width: 42 },
          ],
          rows: history.rows.map((row) => ({ ...row, itemCode: itemCodes.get(row.itemId) ?? row.itemId })),
        }],
      });
    } catch {
      setExportError('Không thể tạo tệp Excel. Hãy thử lại.');
    } finally {
      setExporting(false);
    }
  }

  return <section data-testid="workshop-stock-history" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h3 className="font-bold">Lịch sử nhập – xuất kho</h3>
    <form onSubmit={submit} aria-label="Lọc lịch sử kho" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_2fr_auto]">
      <label className="min-w-0 text-sm">Từ ngày<input aria-label="Từ ngày" type="date" className={fieldClass} value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></label>
      <label className="min-w-0 text-sm">Đến ngày<input aria-label="Đến ngày" type="date" className={fieldClass} value={draft.through} onChange={(e) => setDraft({ ...draft, through: e.target.value })} /></label>
      <label className="min-w-0 text-sm">Mặt hàng
        <select className={fieldClass} value={draft.itemId} onChange={(e) => setDraft({ ...draft, itemId: e.target.value })}>
          <option value="">Tất cả mặt hàng</option>
          {items.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-2">
        <button type="submit" className={`${buttonClass} bg-[#0F2942] text-white`}>Lọc</button>
        <button type="button" className={buttonClass} onClick={() => { setDraft(emptyFilters); apply(emptyFilters); }}>Bỏ lọc</button>
      </div>
    </form>
    {filterError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{filterError}</p>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-slate-600 dark:text-slate-300">{context}</p>
      <button type="button" className={buttonClass} disabled={!history?.rows.length || Boolean(history.omitted || history.overLimit) || exporting} onClick={() => void download()}>
        {exporting ? 'Đang tạo Excel…' : 'Xuất Excel lịch sử'}
      </button>
    </div>
    {exportError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{exportError}</p>}
    {readError ? <div className="flex flex-wrap items-center gap-2"><p role="alert" className="text-sm">{readError}</p>
      <button type="button" className={buttonClass} onClick={() => { setReadError(''); setAttempt((n) => n + 1); }}>Tải lại lịch sử</button>
    </div> : !history && <p role="status" className="text-sm">Đang chờ lịch sử từ Firestore…</p>}
    {history?.overLimit && <p role="status" className="text-sm">Có hơn {reportLimit} biến động. Thu hẹp bộ lọc để xuất báo cáo đầy đủ.</p>}
    {!!history?.omitted && <p role="status" className="text-sm">Có {history.omitted} phiếu có dữ liệu không hợp lệ. Hãy đối chiếu trước khi xuất Excel.</p>}
    {history && !history.rows.length && <p className="text-sm">{filtered ? 'Không tìm thấy biến động phù hợp.' : 'Chưa có biến động kho.'}</p>}
    {!!history?.rows.length && <div className="overflow-x-auto">
      <table aria-label="Lịch sử nhập – xuất kho" className="w-full min-w-[760px] text-left text-sm">
        <thead><tr>{['Thời gian', 'Mã phiếu', 'Mặt hàng', 'Loại', 'Số lượng', 'Tồn trước', 'Tồn sau', 'Ghi chú'].map((name) => <th key={name} scope="col" className="p-2">{name}</th>)}</tr></thead>
        <tbody>{history.rows.slice(0, visible).map((row) => <tr key={row.id} className="border-t dark:border-slate-800">
          <td className="whitespace-nowrap p-2">{row.date}</td><td className="break-all p-2 font-mono text-xs">{row.id}</td>
          <td className="p-2">{itemCodes.get(row.itemId) ?? row.itemId}</td><td className="p-2">{row.type}</td>
          {[row.quantityKg, row.beforeKg, row.afterKg].map((value, column) => <td key={column} className="whitespace-nowrap p-2">{numberFormat.format(value)} kg</td>)}
          <td className="p-2">{row.note || '—'}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {history && visible < history.rows.length && <button type="button" className={buttonClass} onClick={() => setVisible(visible + pageSize)}>Xem thêm</button>}
  </section>;
}
