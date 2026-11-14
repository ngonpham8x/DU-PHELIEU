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
export function ReleaseReadiness(){
 const [done,setDone]=useState<Record<number,boolean>>({});
 const n=Object.values(done).filter(Boolean).length;
 return <details className="rounded-xl border border-amber-200 bg-white p-5 dark:border-amber-800 dark:bg-slate-900" data-testid="phase4e-checklist">
  <summary className="cursor-pointer font-bold">Kiểm tra trước khi vận hành dữ liệu thật ({n}/{checks.length})</summary>
  <div className="mt-3 space-y-3">
   <p className="text-xs text-amber-800">Danh sách theo dõi nội bộ; chỉ mở khi quản trị viên cần kiểm tra triển khai.</p>
   <div className="grid grid-cols-1 gap-2 md:grid-cols-2">{checks.map(([label,desc],i)=><label key={label} className="flex cursor-pointer gap-2 rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800"><input type="checkbox" checked={!!done[i]} onChange={e=>setDone(x=>({...x,[i]:e.target.checked}))}/><span><strong className="block">{label}</strong><span className="text-slate-500">{desc}</span></span></label>)}</div>
  </div>
 </details>
}
