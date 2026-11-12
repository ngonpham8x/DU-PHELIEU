# Dư-Nhựa phế liệu – bản phát triển module Phase 4A–4F

Dự án quản lý nội bộ xưởng **phân loại và băm nhựa phế liệu**. Nền tảng gốc là Vite, React 19, TypeScript, Firebase Auth/Firestore. Bản này bổ sung các module độc lập, không chuyển đổi dữ liệu Production.

**Tải hướng dẫn chi tiết:**
- `docs/PHASE4A_4F_STATUS.md`: bảng tiến độ, chỗ đã hoạt động DEMO và chỗ bị chặn.
- `docs/PHASE4E_SECURITY.md`: bảo mật hiện trạng.
- `docs/PHASE4F_VERIFY_AND_DEPLOY.md`: kiểm thử, triển khai, sao lưu và rollback.
- `docs/FIRESTORE_WORKSHOP_V2_DRAFT.rules`: **chỉ là bản thiết kế**, không triển khai trực tiếp.

## Chạy trên máy tính

```sh
npm install
npm run dev
```

Mở địa chỉ `http://localhost:3000` (hoặc URL mà Vite hiển thị). Chọn **DEMO** để thử các module 4B/4C/4D mới.

```sh
npm run lint
npm run lint:rules
npm test
npm run build
```

Hoặc chạy toàn bộ bằng một lệnh:

```sh
npm run check
```

Trạng thái kiểm tra gần nhất (12/11/2026): TypeScript đạt, 53/53 logic tests đạt, Rules hiện tại đạt 7/7 Emulator, Rules nhiều xưởng dự thảo đạt 8/8 Emulator, Vite production build đạt và Playwright E2E đạt trên Chromium desktop/mobile. Production đã được khóa theo tài khoản được cấp trước. Trang Cài đặt có công cụ xem trước chuyển nhân sự/ca làm chỉ đọc, không ghi Firestore và không mang dữ liệu sinh trắc học cũ. Rules nhiều xưởng vẫn chưa triển khai; chưa nghiệm thu Camera/PWA trên thiết bị thật hoặc giao dịch Production.

Giao diện bảng: trên desktop/tablet, bảng dài có thanh cuộn ngang; dưới 768px, mỗi dòng tự chuyển thành thẻ mobile và giữ nhãn của từng cột. Logo mặc định của giao diện lấy từ `public/logo-horizontal.svg` (đã đối chiếu trùng với file nguồn trong Downloads).

## Nơi cập nhật
- `src/modules/phase4b`: Hồ sơ và kỳ lương DEMO (quy trình, kiểm thử).
- `src/modules/phase4c`: Kiểm tra mẻ băm & lịch bảo trì DEMO.
- `src/modules/phase4d`: Thẻ kho DEMO và báo cáo đối soát.
- `src/modules/phase4e`: Checklist trước triển khai.
- `src/App.tsx`: Chỉ tích hợp module và ngăn ghi Production không an toàn.
- `public/sw.js` + `public/offline.html`: PWA tĩnh ngoại tuyến.

**Lưu ý:** Nhận diện khuôn mặt thật và multi-tenant Firestore, bảng lương/kho Production vẫn chưa đủ điều kiện hoạt động. Không tự triển khai Rules mới, dữ liệu thật cần sao lưu và kiểm thử riêng.
