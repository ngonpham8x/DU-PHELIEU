import React,{useState} from 'react';
const checks=[
 ['Tài khoản quản trị','Bỏ bootstrap theo email hardcode sau khi cấp custom claims tin cậy.'],
 ['Quyền đa tài khoản','Xây workshopId + membership đã xác thực trên máy chủ; thử hai tài khoản chung xưởng.'],
 ['Nhân sự & bảng lương','Đồng bộ Firestore theo quyền, có migration xem trước và rollback.'],
 ['Sổ quỹ lương','Trả lương dùng transaction phía máy chủ và khóa idempotency; không trừ tiền hai lần.'],
 ['Kho và sản xuất','Biến động kho có sourceId duy nhất, khóa khi vượt tồn và đối soát trước khi ghi.'],
 ['Camera thật','Thử webcam và thiết bị thực, có dịch vụ đối sánh 1:1 / chống giả mạo được xác thực.'],
 ['Bảo mật','Chạy Firebase Emulator tests với worker/accountant/owner và xưởng khác.'],
 ['PWA','Kiểm tra cập nhật service worker, offline cache, icon và cài đặt trên Android/iPhone.'],
 ['Bàn giao','Sao lưu dữ liệu, phục hồi thử, kiểm tra build và hướng dẫn vận hành.']
] as const;
export function ReleaseReadiness(){const [done,setDone]=useState<Record<number,boolean>>({});const n=Object.values(done).filter(Boolean).length;
 return <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-5 space-y-3" data-testid="phase4e-checklist"><h2 className="font-bold">Phase 4E–4F – Danh sách nghiệm thu trước Production</h2><p className="text-xs text-amber-800">Danh sách tự đánh dấu chỉ để theo dõi trên màn hình; chưa có kiểm chứng máy chủ và không lưu như bằng chứng nghiệm thu.</p><div className="text-xs font-bold">Đã tự kiểm tra: {n}/{checks.length}</div><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{checks.map(([label,desc],i)=><label key={label} className="flex gap-2 border border-slate-200 dark:border-slate-800 p-3 rounded-lg text-xs cursor-pointer"><input type="checkbox" checked={!!done[i]} onChange={e=>setDone(x=>({...x,[i]:e.target.checked}))}/><span><strong className="block">{label}</strong><span className="text-slate-500">{desc}</span></span></label>)}</div></section>
}
