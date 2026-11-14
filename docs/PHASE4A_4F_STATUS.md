# DƯ-NHỰA PHẾ LIỆU — BẢNG TRẠNG THÁI PHASE 4A → 4F

**Bản giao:** 12/11/2026 — dựa trên mã nguồn ZIP và bản chỉnh 4B trước. Đây là bản phát triển **không triển khai Firebase Production**. Mã nguồn mới được chia thành các module độc lập trong `src/modules/`.

## Các module đã triển khai trong mã nguồn

| Phase | Nơi triển khai | Chức năng đã có | Trạng thái |
|---|---|---|---|
| 4A | App.tsx, các module cũ, `firestore.rules` | Giữ lại nền tảng, kiểm tra rủi ro data/RBAC, không sửa collections đang dùng | Rules hiện tại đã đạt 7/7 kiểm thử Emulator |
| 4B | `src/modules/phase4b`, `functions/` | CRUD/kỳ lương DEMO; migration; backend tạo kỳ từ công duyệt, đối soát tăng ca/sản lượng/các khoản lương, khóa nguồn, duyệt/chốt/trả lương nguyên tử | Backend build/unit/Emulator đạt; **chưa nối UI và chưa deploy staging/Production** |
| 4C | `src/modules/phase4c`, `functions/` | Kiểm tra cân bằng/hao hụt; backend lập, duyệt/hủy mẻ; đối chiếu phiếu cân và quyết toán nguyên liệu–thành phẩm–phế phẩm nguyên tử | Backend build/unit/Emulator đạt; **chưa nối UI và chưa deploy staging/Production** |
| 4D | `src/modules/phase4d`, `functions/` | Thẻ kho DEMO; xuất ExcelJS; backend nhập/xuất nguyên tử theo gram, chống vượt tồn, trùng mã và đồng bộ hai lần cùng chứng từ nguồn | Backend build/unit/Emulator đạt; **chưa deploy staging/Production** |
| 4E | `src/modules/phase4e`, `public/sw.js`, `docs/FIRESTORE_WORKSHOP_V2_DRAFT.rules` | PWA offline tĩnh; Rules nhiều xưởng cách ly tenant, membership/backend ledger chỉ máy chủ ghi; dữ liệu sản xuất đọc theo vai trò | Rules V2 đạt 10/10 Emulator nhưng **chưa deploy** |
| 4F | `docs/`, test `.test.ts`, `tests/e2e`, `firestore.emulator.test.ts`, `package.json` | Bộ kiểm thử logic, Rules Emulator, Playwright E2E desktop/mobile, lint và production build | 53/53 logic + 7/7 Emulator + E2E + build đạt; **chưa** thiết bị thật |

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

**4B:** Đã có màn hình xem trước, gói JSON và backend workshopId/member/migration có backup/rollback. Callable tạo kỳ lương từ cặp vào/ra đã duyệt và khóa nguồn chống tính trùng; công thiếu cặp dừng trước khi ghi. Callable đối soát tăng ca, sản lượng, phụ cấp, thưởng, tạm ứng và khấu trừ cập nhật dòng/tổng kỳ/audit nguyên tử; kỳ chưa đối soát xong không thể gửi duyệt. Luồng duyệt/chốt/trả lương chống lặp. Còn nối UI Production, lấy tạm ứng/sản lượng từ chứng từ đã duyệt, deploy staging và nghiệm thu App Check/bootstrap/migration.

**4C:** Đã có callable lập mẻ chờ duyệt và callable quản lý duyệt/hủy; người lập không được tự duyệt. Khi duyệt, backend đối chiếu lại máy/phiếu cân, trừ nguyên liệu, cộng thành phẩm/phế phẩm, khóa phiếu cân dùng một lần, cập nhật sản lượng máy và audit trong một transaction. Còn nối UI Production, quy trình quản lý danh mục máy/phiếu cân tin cậy, deploy staging và nghiệm thu số liệu thực tế.

**4D:** Đã có callable stock ledger máy chủ cập nhật số dư và phát sinh bất biến trong một transaction, chống xuất vượt tồn và khóa chứng từ nguồn chống đồng bộ hai lần. Còn tạo số dư đầu được duyệt, nối phiếu cân/mẻ băm/UI Production, quy trình kiểm kê và báo cáo theo khoảng thời gian khóa dữ liệu nguồn.

**4E:** Rules hiện tại đạt 7/7 và Rules nhiều xưởng dự thảo đạt 10/10 Emulator, gồm cách ly hai xưởng và dữ liệu sản xuất chỉ backend được ghi. Trusted provisioning bằng Admin SDK đã có mã và kiểm thử cục bộ; còn triển khai staging/migration được phê duyệt, xóa bootstrap email khỏi Rules cũ sau khi chuyển đổi; kiểm tra camera thực tế/consent và PWA trên Android/iPhone.

**4F:** Đã hoàn tất npm install / lint / Rules lint / 53 logic test / 26 backend unit test / 8 backend transaction Emulator / 7 Rules hiện tại / 10 Rules V2 / build và E2E Chromium desktop/mobile. Còn camera và PWA trên thiết bị thật, xử lý advisory dependency khi upstream có bản vá, kiểm tra sao lưu và khôi phục thực tế, chạy staging có ít nhất hai tài khoản và nghiệm thu tại xưởng trước khi lên Production.

**Không tuyên bố hoàn thành Production** khi các mục trên chưa được xác minh.
