# Phase 4F – Hướng dẫn kiểm tra, chạy thử và bàn giao

## Cài đặt tại máy có kết nối Internet
- Node.js tương thích Vite và npm.
- Mở terminal trong thư mục dự án.
- Chạy `npm install`, sau đó `npm run check` và `npm run dev`.
- Mở URL localhost do Vite trả về; dùng môi trường DEMO để thử nghiệm.

### Kiểm thử màn hình bằng tay
- Desktop 1440×900, laptop 1366×768, điện thoại 390×844 và 360×800.
- Sidebar mở/đóng, chỉ một menu; bảng Cân nhựa có cuộn ngang và không xếp chữ dọc.
- Thu/Chi: thử phiếu, sửa, hủy, tải lại, audit.
- Nhân sự: thêm nhân viên DEMO, đổi đơn giá, tạo kỳ, chỉnh tạm ứng, gửi duyệt/chốt, trả một phần và thử trả trùng.
- Kho: nhập một mặt hàng, xem nhật ký; thử xuất lớn hơn tồn phải bị chặn.
- Sản xuất: thử mẻ có đầu ra vượt đầu vào, xem cảnh báo; tạo lịch bảo trì và hoàn thành.
- Đăng nhập với hai vai trò khác nhau trong Firestore Emulator trước khi triển khai Production.
- Camera: kiểm thử quyền web browser, hình ảnh thật, mở/đóng nhiều lần trên Android/Chrome và iOS/Safari nếu có thiết bị. **Không coi màn hình giả là camera thật.**

## Đã thực hiện trong môi trường cập nhật ngày 12/11/2026
- `npm install`: hoàn tất; có `package-lock.json` dùng cho quy trình npm tái lập.
- `npm run lint`: đạt với TypeScript semantic check.
- `npm run lint:rules`: đạt trên `firestore.rules` hiện tại.
- `npm test`: **53/53 đạt**.
- `npm run test:emulator`: **7/7 đạt** với Rules hiện tại trên dự án giả lập `demo-du-nhua-phase4`; không kết nối dữ liệu thật.
- `npm run test:emulator:v2`: **10/10 đạt** với Rules nhiều xưởng dự thảo; kiểm tra cách ly tenant, vai trò, dữ liệu công/lương/sản xuất và dấu vết migration.
- `npm run test:functions && npm run build:functions`: backend trusted provisioning/migration/payroll/production/stock đạt **26/26** unit tests và build TypeScript.
- `npm run test:functions:emulator`: **8/8 đạt** cho tạo kỳ từ công duyệt, khóa nguồn, đối soát tăng ca, giao dịch lương, kho và mẻ sản xuất nguyên tử; kiểm tra chống lặp, công thiếu cặp, khóa gửi duyệt, vượt tồn, tự duyệt, hủy không đổi kho và dùng lại phiếu cân; chỉ dùng dự án Emulator.
- `npm run test:e2e`: đạt trên Chromium desktop/mobile; kiểm tra menu cố định, thanh đầu trang co giãn, chuyển dạng bảng/thẻ, bố cục in riêng từng nhân viên, cảnh báo Production không lặp và tải tệp ExcelJS `.xlsx`.
- `npm run build`: đạt với Vite 8; các màn hình Phase 4 và modal lớn được tách thành chunk tải theo nhu cầu.
- Smoke test localhost: mở được Nhân sự, Sản xuất, Kho, Cài đặt; bố cục và menu tại 390×844 hiển thị đúng; không thấy lỗi console trong các luồng đã mở.
- `npm audit` còn advisory gián tiếp từ Firebase/`@grpc/grpc-js` và chuỗi công cụ lint; tại thời điểm kiểm tra chưa có bản vá không phá vỡ tương thích. Không chạy `npm audit fix --force`.
- Firestore Emulator dùng Java 21 di động trong `.tools/java21` và đã chạy thành công. Thư mục công cụ không được đưa lên Git; máy mới có thể dùng Java đã cài hoặc đặt bản di động cùng vị trí.
- **Chưa kiểm tra camera thật hoặc PWA trên Android/iPhone thật.** Cả Rules hiện tại và Rules nhiều xưởng dự thảo đã chạy Emulator, nhưng V2 vẫn cần trusted provisioning, staging và migration được phê duyệt trước Production. Playwright E2E mô phỏng kích thước desktop/mobile không thay thế nghiệm thu thiết bị thật.
- Không chạy migration hoặc deployment nào đối với Firestore Production.

## Triển khai an toàn
1. Lưu bản ZIP gốc và xuất Firestore Backup từ môi trường có quyền quản trị.
2. So sánh mã thay đổi bằng `git diff` hoặc VS Code Compare với phiên bản gốc.
3. Tải package về máy cục bộ, cài thư viện và chạy đủ test.
4. Dùng một Firebase **staging** khác hoặc Firestore Emulator để kiểm thử rules và cấu trúc dữ liệu.
5. Đưa lên hosting thử (HTTPS), dùng tài khoản thử nghiệm, kiểm tra luồng camera và phân quyền.
6. Chỉ sau nghiệm thu mới lên Production, theo từng module và có phương án rollback. **Không chép Rules dự thảo vào Production.**

## Khôi phục / quay về
- Nếu chỉ cập nhật mã nguồn: quay về mã nguồn gốc từ ZIP đã lưu và triển khai lại giao diện.
- Nếu đã thay đổi dữ liệu Firestore ở bước sau: chỉ khôi phục từ bản sao lưu Firestore tương ứng được xác minh; không dùng localStorage DEMO để khôi phục dữ liệu Production.
- Nếu PWA dùng cache phiên bản cũ: tải lại, kiểm tra service worker/caches; người dùng có thể phải mở lại ứng dụng để nhận tài nguyên mới.
