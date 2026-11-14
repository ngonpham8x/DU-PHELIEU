import { useRef, useState, type FormEvent } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { parseStockKilograms } from './workshopStock';

type OpeningStock = { workshopId: string; code: string; name: string; openingGrams: number; reference: string };
const initializeItem = httpsCallable<OpeningStock, { ok: boolean; itemId: string }>(
  functions, 'initializeStockItem', { limitedUseAppCheckTokens: true },
);
const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900';

export function OpeningStockForm({ workshopId, onSaved, onCancel }: {
  workshopId: string;
  onSaved: (itemId: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const code = String(form.get('code')).trim().toUpperCase();
      const name = String(form.get('name')).trim();
      const reference = String(form.get('reference')).trim();
      if (!/^[A-Z0-9_-]{2,40}$/.test(code)) throw new Error('Mã mặt hàng phải có 2–40 ký tự gồm chữ, số, dấu gạch ngang hoặc gạch dưới.');
      if (name.length < 2 || reference.length < 3) throw new Error('Nhập tên mặt hàng và số biên bản hoặc căn cứ kiểm kê.');
      const openingGrams = parseStockKilograms(String(form.get('openingKg')), { allowZero: true });
      const { data } = await initializeItem({ workshopId, code, name, openingGrams, reference });
      if (!data.ok || data.itemId !== code) throw new Error('Chưa nhận được xác nhận. Kiểm tra danh mục hoặc gửi lại cùng mã mặt hàng và dữ liệu.');
      onSaved(data.itemId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Chưa thể lưu tồn đầu. Hãy thử lại cùng mã mặt hàng.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return <form aria-labelledby="opening-stock-title" onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
    <h3 id="opening-stock-title" className="font-bold">Thiết lập tồn đầu</h3>
    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Tạo mặt hàng mới theo số dư đã kiểm kê. Tồn đầu được lưu cùng biên bản để đối chiếu.</p>
    <fieldset disabled={busy} className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-sm font-medium">Mã mặt hàng<input name="code" autoComplete="off" required maxLength={40} className={fieldClass} /></label>
      <label className="text-sm font-medium">Tên mặt hàng<input name="name" required maxLength={120} className={fieldClass} /></label>
      <label className="text-sm font-medium">Tồn đầu (kg)<input name="openingKg" required inputMode="decimal" maxLength={16} className={fieldClass} /></label>
      <label className="text-sm font-medium">Biên bản hoặc căn cứ kiểm kê<input name="reference" required maxLength={300} className={fieldClass} /></label>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
    <div className="mt-4 flex flex-wrap justify-end gap-2">
      <button type="button" disabled={busy} onClick={onCancel} className="min-h-11 rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Hủy</button>
      <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-[#0F2942] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Đang lưu…' : 'Xác nhận tồn đầu'}</button>
    </div>
  </form>;
}
