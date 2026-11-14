import { useEffect, useRef, useState, type FormEvent } from 'react';
import { collection, doc, getDocFromServer, limit, onSnapshot, orderBy, query, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { appCheckConfigured, functions, stockEmulatorEnabled, workshopDb } from '../../lib/firebase';
import { OpeningStockForm } from './OpeningStockForm';
import {
  isWorkshopId, parseStockKilograms, readPendingStockMovement, readWorkshopInventoryItem,
  type ManualStockMovement, type StockDirection, type WorkshopInventoryItem,
} from './workshopStock';

type Access = { workshopId: string; canWrite: boolean; canInitialize: boolean };
type HistoryRow = { id: string; itemId: string; kind: 'in' | 'out' | 'opening'; grams: number; before: number; after: number; date: string; note: string };

const postMovement = httpsCallable<ManualStockMovement, { ok: boolean; movementId: string }>(
  functions, 'postStockMovement', { limitedUseAppCheckTokens: true },
);
const inputClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';
const actionClass = 'min-h-11 rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const boxClass = 'space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900';
const stockRejections = ['functions/invalid-argument', 'functions/failed-precondition', 'functions/already-exists'];
const numberFormat = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 3 });
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' });
const kg = (grams: number) => `${numberFormat.format(grams / 1000)} kg`;
const readOnlyCodes = ['functions/permission-denied', 'functions/unauthenticated'];
const stockCallableAvailable = appCheckConfigured || stockEmulatorEnabled;

function errorCode(error: unknown) {
  return typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
}

export function WorkshopInventory({ user }: { user: User | null }) {
  return (
    <div className="space-y-4" data-testid="page-inventory-production">
      <h2 className="text-lg font-bold">Kho nhựa</h2>
      {!user || !user.emailVerified
        ? <p role="status" className={boxClass}>Đăng nhập bằng email đã xác minh để mở kho của xưởng.</p>
        : <WorkshopInventoryAccess key={`${user.uid}:${user.email}`} user={user} />}
    </div>
  );
}

function WorkshopInventoryAccess({ user }: { user: User }) {
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadAccess() {
      try {
        const pointer = (await getDocFromServer(doc(workshopDb, 'user_workshops', user.uid))).data();
        if (!active) return;
        if (pointer?.uid !== user.uid || pointer.email !== user.email || pointer.status !== 'active' || !isWorkshopId(pointer.workshopId)) {
          setError('Tài khoản chưa được cấp quyền vào kho của xưởng.');
          return;
        }
        const { workshopId } = pointer;
        const member = (await getDocFromServer(doc(workshopDb, 'workshops', workshopId, 'members', user.uid))).data();
        if (!active) return;
        if (member?.uid !== user.uid || member.email !== user.email || member.workshopId !== workshopId || member.status !== 'active' ||
          !['owner', 'manager', 'production', 'accountant'].includes(member.role)) {
          setError('Tài khoản chưa được cấp quyền vào kho của xưởng.');
          return;
        }
        setAccess({ workshopId, canWrite: member.role !== 'accountant', canInitialize: member.role === 'owner' });
      } catch (cause) {
        if (!active) return;
        setError(errorCode(cause) === 'permission-denied'
          ? 'Tài khoản chưa được cấp quyền vào kho của xưởng.'
          : 'Không thể kiểm tra quyền kho. Hãy kiểm tra kết nối và thử lại.');
      }
    }
    void loadAccess();
    return () => { active = false; };
  }, [user.uid, user.email, attempt]);

  if (error) return <div className={boxClass}>
    <p role="alert">{error}</p>
    <button type="button" className={actionClass} onClick={() => { setError(''); setAttempt((value) => value + 1); }}>Thử lại</button>
  </div>;
  if (!access) return <p role="status">Đang kiểm tra quyền truy cập kho…</p>;
  return <WorkshopStockActivity access={access} uid={user.uid} />;
}

function WorkshopStockActivity({ access, uid }: { access: Access; uid: string }) {
  const { workshopId } = access;
  const storageKey = `dunhua_pending_stock_v1:${workshopDb.app.options.projectId}:${uid}:${workshopId}`;
  const [pending, setPending] = useState(() => {
    try { return readPendingStockMovement(localStorage.getItem(storageKey), workshopId); } catch { return null; }
  });
  const [items, setItems] = useState<WorkshopInventoryItem[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [ready, setReady] = useState(false);
  const [historyReady, setHistoryReady] = useState(false);
  const [dataError, setDataError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [direction, setDirection] = useState<StockDirection | null>(null);
  const [showOpening, setShowOpening] = useState(false);
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const item = items.find((entry) => entry.id === itemId && !entry.inactive);

  useEffect(() => {
    function syncPending(event: StorageEvent) {
      if (event.key === storageKey && !sending.current) {
        setPending(readPendingStockMovement(event.newValue, workshopId));
      }
    }
    window.addEventListener('storage', syncPending);
    return () => window.removeEventListener('storage', syncPending);
  }, [storageKey, workshopId]);

  useEffect(() => {
    const live = { includeMetadataChanges: true };
    const onError = () => {
      setDataError('Không thể tải kho của xưởng. Hãy kiểm tra quyền truy cập và kết nối.');
      setItems([]);
      setHistory([]);
      setReady(false);
      setHistoryReady(false);
    };
    const stopItems = onSnapshot(collection(workshopDb, 'workshops', workshopId, 'inventory_items'), live, (snapshot) => {
      setReady(!snapshot.metadata.fromCache);
      if (snapshot.metadata.fromCache) return;
      setItems(snapshot.docs.flatMap((entry) => {
        const item = readWorkshopInventoryItem(entry.id, workshopId, entry.data());
        return item ? [item] : [];
      }).sort((a, b) => a.code.localeCompare(b.code, 'vi')));
    }, onError);
    const stopHistory = onSnapshot(query(collection(workshopDb, 'workshops', workshopId, 'stock_movements'), orderBy('createdAt', 'desc'), limit(50)), live, (snapshot) => {
      setHistoryReady(!snapshot.metadata.fromCache);
      if (snapshot.metadata.fromCache) return;
      setHistory(snapshot.docs.flatMap((entry) => {
        const data = entry.data();
        const opening = data.sourceType === 'opening_balance';
        if (data.workshopId !== workshopId || (data.type !== 'in' && data.type !== 'out') ||
          !isWorkshopId(data.itemId) || !(data.createdAt instanceof Timestamp) ||
          ![data.quantityGrams, data.stockBefore, data.stockAfter].every((value) => Number.isSafeInteger(value) && value >= 0) ||
          (!opening && data.quantityGrams === 0)) return [];
        return [{ id: entry.id, itemId: data.itemId, kind: opening ? 'opening' : data.type, grams: data.quantityGrams,
          before: data.stockBefore, after: data.stockAfter, date: dateFormat.format(data.createdAt.toDate()), note: typeof data.note === 'string' ? data.note : '' }];
      }));
    }, onError);
    return () => { stopItems(); stopHistory(); };
  }, [workshopId, attempt]);

  function clearPending(input: ManualStockMovement) {
    const current = readPendingStockMovement(localStorage.getItem(storageKey), workshopId);
    if (current?.movementId === input.movementId) localStorage.removeItem(storageKey);
    setPending(current?.movementId !== input.movementId ? current : null);
  }

  async function send(input: ManualStockMovement, retry: boolean) {
    if (sending.current || !access.canWrite || !stockCallableAvailable || !ready || !historyReady || dataError) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const { data } = await postMovement(input);
      if (!data.ok || data.movementId !== input.movementId) throw new Error('Máy chủ chưa xác nhận mã phiếu.');
      setDirection(null);
      setMessage(`Đã ghi nhận ${input.type === 'in' ? 'nhập kho' : 'xuất kho'} ${kg(input.quantityGrams)}. Mã phiếu: ${input.movementId}`);
      try {
        clearPending(input);
      } catch {
        setError('Đã ghi kho. Trình duyệt chưa xóa được phiếu chờ. Hãy kiểm tra quyền lưu trữ rồi đối chiếu lại cùng mã.');
      }
    } catch (cause) {
      const code = errorCode(cause);
      if (stockRejections.includes(code) || (!retry && readOnlyCodes.includes(code))) {
        try {
          clearPending(input);
        } catch {
          setError('Trình duyệt không thể xóa phiếu đang chờ. Hãy kiểm tra quyền lưu trữ rồi gửi lại cùng mã phiếu.');
          return;
        }
        setError(stockRejections.includes(code) && cause instanceof Error ? cause.message : 'Máy chủ từ chối phiếu. Kiểm tra dữ liệu và quyền rồi thử lại.');
      } else {
        setError('Chưa thể hoàn tất đối chiếu phiếu. Hãy gửi lại cùng mã để máy chủ kiểm tra và tránh ghi trùng.');
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!direction || !item || !canPost || sending.current) return;

    const prepare = () => {
      // Serialize the check and save across browser tabs when Web Locks is available.
      const outstanding = localStorage.getItem(storageKey);
      if (outstanding) {
        const storedMovement = readPendingStockMovement(outstanding, workshopId);
        if (!storedMovement) throw new Error('Phiếu chờ trên thiết bị không đọc được. Liên hệ quản lý để kiểm tra lịch sử kho.');
        setPending(storedMovement);
        throw new Error('Đang có phiếu chờ trong trình duyệt. Hãy đối chiếu phiếu đó trước.');
      }
      const quantityGrams = parseStockKilograms(quantity);
      if (direction === 'out' && quantityGrams > item.stockGrams) throw new Error(`Số lượng xuất vượt tồn. Mặt hàng còn ${kg(item.stockGrams)}.`);
      const movementId = `KHO_${crypto.randomUUID()}`;
      const input: ManualStockMovement = { workshopId, movementId, itemId: item.id, type: direction,
        quantityGrams, sourceType: 'manual', sourceId: movementId, note: note.trim() };
      localStorage.setItem(storageKey, JSON.stringify(input));
      return input;
    };

    try {
      const input = navigator.locks ? await navigator.locks.request(storageKey, prepare) : prepare();
      setPending(input);
      void send(input, false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu phiếu chờ trên thiết bị.');
    }
  }

  const onlineDataReady = ready && historyReady && !dataError;
  const canSend = access.canWrite && stockCallableAvailable && onlineDataReady && !busy;
  const canPost = canSend && !pending;
  const showMovementButtons = !dataError && items.some((entry) => !entry.inactive) && access.canWrite;
  const label = direction === 'out' ? 'Xuất kho' : 'Nhập kho';
  const openForm = (next: StockDirection) => {
    setDirection(next); setQuantity(''); setNote(''); setError(''); setMessage('');
  };

  return <>
    <p className="text-sm text-slate-600 dark:text-slate-300">Mã xưởng: {workshopId}</p>
    {dataError ? <div className={boxClass}>
      <p role="alert">{dataError}</p>
      <button type="button" className={actionClass} onClick={() => { setDataError(''); setAttempt((value) => value + 1); }}>Tải lại kho</button>
    </div> : !onlineDataReady && <p role="status">Đang chờ dữ liệu kho từ Firestore…</p>}
    {access.canWrite && !stockCallableAvailable && <p role="status">Bản web cần cấu hình App Check để gửi phiếu kho.</p>}
    {!access.canWrite && <p role="status">Tài khoản có quyền xem kho.</p>}
    {pending && <section className={boxClass}>
      <p className="break-words font-semibold">Phiếu chờ đối chiếu: {pending.movementId}</p>
      <p className="text-sm">{pending.type === 'in' ? 'Nhập' : 'Xuất'} {kg(pending.quantityGrams)} · {items.find((entry) => entry.id === pending.itemId)?.code ?? pending.itemId}</p>
      <button type="button" className={actionClass} disabled={!canSend} onClick={() => void send(pending, true)}>Gửi lại cùng mã phiếu</button>
    </section>}
    {error && <p role="alert" className="break-words text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    {message && <p role="status" className="break-words text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
    {(showMovementButtons || access.canInitialize) && <div className="flex flex-wrap gap-2">
      {showMovementButtons && <>
        <button type="button" className={actionClass} disabled={!canPost || showOpening} onClick={() => openForm('in')}>Nhập kho</button>
        <button type="button" className={actionClass} disabled={!canPost || showOpening} onClick={() => openForm('out')}>Xuất kho</button>
      </>}
      {access.canInitialize && <button type="button" className={actionClass} disabled={!canPost || showOpening}
        onClick={() => { setDirection(null); setShowOpening(true); setError(''); setMessage(''); }}>Thiết lập tồn đầu</button>}
    </div>}
    {showOpening && <OpeningStockForm workshopId={workshopId} onCancel={() => setShowOpening(false)}
      onSaved={(id) => { setShowOpening(false); setMessage(`Đã ghi tồn đầu cho mặt hàng ${id}.`); }} />}
    {direction && !pending && <form className={boxClass} onSubmit={submit} aria-labelledby="workshop-stock-form-title">
      <h3 id="workshop-stock-form-title" className="font-bold">{label}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="min-w-0 text-sm font-medium">Mặt hàng
          <select className={inputClass} required value={itemId} onChange={(event) => setItemId(event.target.value)}>
            <option value="">Chọn mặt hàng</option>
            {items.filter((entry) => !entry.inactive).map((entry) => <option key={entry.id} value={entry.id}>{entry.code} · {entry.name}</option>)}
          </select>
          {item && <span className="mt-1 block text-xs">Tồn hiện tại: {kg(item.stockGrams)}</span>}
        </label>
        <label className="text-sm font-medium">Số lượng (kg)
          <input className={inputClass} inputMode="decimal" required maxLength={16} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </label>
      </div>
      <label className="block text-sm font-medium">Ghi chú (tùy chọn)
        <input className={inputClass} maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="min-h-11 rounded-lg border px-4 py-2 text-sm" onClick={() => { setDirection(null); setError(''); }}>Hủy</button>
        <button type="submit" disabled={!canPost || !item} className={actionClass}>Xác nhận {label.toLowerCase()}</button>
      </div>
    </form>}
    {!dataError && ready && <section className={boxClass}>
      <h3 className="font-bold">Tồn kho</h3>
      {items.length === 0 ? <p className="text-sm">Chưa có mặt hàng quản lý theo kg được thiết lập cho xưởng.</p> : <div className="overflow-x-auto">
        <table aria-label="Tồn kho" className="w-full min-w-[520px] text-left text-sm">
          <thead><tr>{['Mã', 'Mặt hàng', 'Tồn đầu', 'Tổng nhập', 'Tổng xuất', 'Hiện còn'].map((name) => <th key={name} scope="col" className="p-2">{name}</th>)}</tr></thead>
          <tbody>{items.map((entry) => <tr key={entry.id} className="border-t dark:border-slate-800">
            <td className="p-2">{entry.code}</td><td className="p-2">{entry.name}{entry.inactive && ' · Ngừng sử dụng'}</td>
            <td className="whitespace-nowrap p-2">{entry.openingGrams === undefined ? '—' : kg(entry.openingGrams)}</td>
            <td className="whitespace-nowrap p-2">{kg(entry.inGrams)}</td><td className="whitespace-nowrap p-2">{kg(entry.outGrams)}</td>
            <td className="whitespace-nowrap p-2 font-semibold">{kg(entry.stockGrams)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>}
    {!dataError && historyReady && <section className={boxClass}>
      <h3 className="font-bold">Lịch sử nhập – xuất kho</h3>
      {history.length === 50 && <p className="text-xs text-slate-500">50 biến động gần nhất</p>}
      {history.length === 0 ? <p className="text-sm">Chưa có biến động kho.</p> : <div className="overflow-x-auto">
        <table aria-label="Lịch sử nhập – xuất kho" className="w-full min-w-[760px] text-left text-sm">
          <thead><tr>{['Thời gian', 'Mã phiếu', 'Mặt hàng', 'Loại', 'Số lượng', 'Tồn trước', 'Tồn sau', 'Ghi chú'].map((name) => <th key={name} scope="col" className="p-2">{name}</th>)}</tr></thead>
          <tbody>{history.map((entry) => <tr key={entry.id} className="border-t dark:border-slate-800">
            <td className="whitespace-nowrap p-2">{entry.date}</td><td className="break-all p-2 font-mono text-xs">{entry.id}</td>
            <td className="p-2">{items.find((item) => item.id === entry.itemId)?.code ?? entry.itemId}</td>
            <td className="p-2">{entry.kind === 'opening' ? 'Tồn đầu' : entry.kind === 'in' ? 'Nhập' : 'Xuất'}</td><td className="whitespace-nowrap p-2">{kg(entry.grams)}</td>
            <td className="whitespace-nowrap p-2">{kg(entry.before)}</td><td className="whitespace-nowrap p-2">{kg(entry.after)}</td><td className="p-2">{entry.note || '—'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section>}
  </>;
}
