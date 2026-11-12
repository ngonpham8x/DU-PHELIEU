# DƯ-NHỰA PHẾ LIỆU — BẢNG TRẠNG THÁI PHASE 4A → 4F

**Bản giao:** 12/11/2026 — dựa trên mã nguồn ZIP và bản chỉnh 4B trước. Đây là bản phát triển **không triển khai Firebase Production**. Mã nguồn mới được chia thành các module độc lập trong `src/modules/`.

## Các module đã triển khai trong mã nguồn

| Phase | Nơi triển khai | Chức năng đã có | Trạng thái |
|---|---|---|---|
| 4A | App.tsx, các module cũ, `firestore.rules` | Giữ lại nền tảng, kiểm tra rủi ro data/RBAC, không sửa collections đang dùng | Rules hiện tại đã đạt 7/7 kiểm thử Emulator |
| 4B | `src/modules/phase4b` | CRUD hồ sơ DEMO, dự thảo kỳ lương, tính công & lương, nhập ứng/phụ cấp, phê duyệt/chốt, thanh toán một phần/tất toán DEMO, CSV, audit | DEMO dùng được; Production **chưa bật** |
| 4C | `src/modules/phase4c` | Kiểm tra cân bằng mẻ băm; cảnh báo hao hụt; phát hiện mã phiếu trùng; lập/hoàn thành lịch bảo trì máy | DEMO; Production chưa có kho máy chủ |
| 4D | `src/modules/phase4d` | Thẻ kho phát sinh từ thao tác nhập/xuất thủ công mới, kiểm tra vượt tồn và trùng nguồn, thống kê dòng tiền, cân nhựa, băm nhựa; xuất CSV | DEMO; Production chưa bật ghi tồn kho |
| 4E | `src/modules/phase4e`, `public/sw.js`, `docs/FIRESTORE_WORKSHOP_V2_DRAFT.rules` | Danh sách nghiệm thu, PWA offline tĩnh, tránh cache dữ liệu nghiệp vụ, bản thiết kế Rules nhiều tài khoản | Đã có mã; Rules mới **không deploy** |
| 4F | `docs/`, test `.test.ts`, `tests/e2e`, `firestore.emulator.test.ts`, `package.json` | Bộ kiểm thử logic, Rules Emulator, Playwright E2E desktop/mobile, lint và production build | 47/47 logic + 7/7 Emulator + E2E + build đạt; **chưa** thiết bị thật |

## Luồng chạy DEMO

1. Chạy dự án với `npm install && npm run dev` trên máy có kết nối Internet; mở trình duyệt theo địa chỉ Vite.
2. Chọn **DEMO**, vai trò **Chủ xưởng**.
3. Trang **Nhân sự**: có phần *Thêm/Sửa hồ sơ* và *Quy trình kỳ lương DEMO*. Tạo kỳ lương, nhập các khoản tạm ứng/sản lượng đã nghiệm thu thử, gửi duyệt, duyệt, chốt và thử trả một phần. Phiếu chi DEMO xuất hiện trong Sổ Thu – Chi.
4. Trang **Phân loại & Băm nhựa**: xem bảng kiểm tra mẻ và tạo lịch bảo trì máy DEMO.
5. Trang **Kho nhựa**: dùng form Nhập/Xuất hiện có, sau đó xem *Thẻ kho DEMO* mới. Thẻ chỉ lưu biến động mới, không thể suy ra lịch sử cũ.
6. Trang **Báo cáo**: xem các tổng hợp tiền, khối lượng; thông tin này không phải lợi nhuận hay quyết toán.
7. Trang **Cài đặt**: đọc checklist nghiệm thu 4E–4F.

## Ranh giới dữ liệu

- Sổ thu chi, cân và chấm công legacy giữ nguyên logic cũ; không thay đổi schema Firebase.
- Các module mới **chỉ ghi localStorage DEMO** dưới khóa riêng:
  - `dunhua_demo_payroll_periods_v2`
  - `dunhua_demo_maintenance_v1`
  - `dunhua_demo_stock_movements_v1`
- Hồ sơ nhân sự và danh mục cũ vẫn có `localStorage` từ dự án gốc; chúng không phải nguồn Production đáng tin cậy.
- Có bản dự thảo Rules cho workshop nhiều tài khoản nhưng **không được tự copy đè và deploy**.
- Sổ lương DEMO có phiếu chi liên kết, không thể xem là thanh toán ngân hàng thật; chống trùng ở UI và helper vẫn **không thay thế** transaction máy chủ.
- Chức năng chuẩn hóa nhãn mủ cao su thành loại nhựa đã **tạm khóa** vì không có căn cứ đổi vật liệu lịch sử.
- Nhận diện khuôn mặt và liveness 1:1 chưa có AI sinh trắc học thật; không được coi như chấm công bằng mặt Production.

## Điều kiện để hoàn tất Production (đang để riêng, cần triển khai và kiểm thử tiếp)

**4B:** Cơ chế workshopId/member server-trusted; migrate hồ sơ và ca lên Firestore có bản sao lưu và màn hình xem trước; duyệt/chốt/trả lương qua server transaction một lần, RBAC xem phiếu lương của riêng nhân viên.

**4C:** Lưu phiếu sản xuất và máy theo workshopId, workflow duyệt/huỷ; đối chiếu cân nhựa trước khi biến động tồn; định danh nguồn chứng từ duy nhất.

**4D:** Stock ledger máy chủ với số dư đầu và phát sinh bất biến, phương pháp kiểm kê, không đồng bộ hai lần khi reload/nhiều người cùng ghi; báo cáo theo khoảng thời gian được khóa dữ liệu nguồn.

**4E:** Xóa bootstrap email hardcode sau khi thiết lập trusted admin; Rules hiện tại đã được thử bằng Emulator với nhiều UID nhưng mô hình Rules nhiều xưởng vẫn là dự thảo; còn kiểm tra camera thực tế/consent và PWA trên Android/iPhone.

**4F:** Đã hoàn tất npm install / lint / Rules lint / 47 logic test / 7 Rules Emulator / build, smoke test localhost và E2E tự động trên Chromium desktop/mobile. Còn camera và PWA trên thiết bị thật, xử lý advisory dependency khi upstream có bản vá, kiểm tra sao lưu và khôi phục thực tế, chạy staging có ít nhất hai tài khoản và nghiệm thu tại xưởng trước khi lên Production.

**Không tuyên bố hoàn thành Production** khi các mục trên chưa được xác minh.
