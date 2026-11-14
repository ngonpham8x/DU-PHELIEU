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

### Nghiệm thu kho trên máy phát triển

Chạy `npm run test:stock:ui` sau khi cài Chromium cho Playwright. Chủ xưởng tạo mặt hàng có tồn đầu 100 kg và số biên bản kiểm kê trong Firebase Emulator. Quản lý nhập 1,25 kg, mất phản hồi sau khi máy chủ ghi, tải lại và gửi cùng mã. Sau đó thử xuất vượt tồn, xuất 0,75 kg và đối chiếu tồn cuối 100,5 kg. Kế toán chỉ xem được tồn. App Check và quyền triển khai Cloud Functions cần nghiệm thu riêng trên staging.

### Chuẩn bị Firebase staging cho Kho nhựa

1. Chọn dự án Firebase riêng cho Kho nhựa thử nghiệm. Tạo hai cơ sở Firestore Native `(default)` và `legacy`, đăng ký ứng dụng web và bật đăng nhập Google. Cho phép miền web staging trong Authentication và đăng ký site key reCAPTCHA Enterprise cho App Check của ứng dụng staging. Để xác minh token dùng một lần, cấp cho tài khoản dịch vụ chạy Functions quyền **Firebase App Check Token Verifier** theo [hướng dẫn Firebase](https://firebase.google.com/docs/app-check/cloud-functions#replay_protection).
2. Tạo `.env.staging.local` từ các biến staging trong `.env.example`. Điền `VITE_STAGING_FIREBASE_CONFIG` bằng cấu hình web của dự án đã chọn, thêm `firestoreDatabaseId: "legacy"` vào JSON và điền `VITE_STAGING_FIREBASE_APPCHECK_SITE_KEY`. Đặt `BOOTSTRAP_ADMIN_EMAILS` cho Functions trong `functions/.env.<mã-dự-án-staging>`. Dùng tài khoản thử nghiệm đã xác minh email.
3. Chạy `npm run stock:staging -- <mã-dự-án-staging>` để kiểm tra dự án, ứng dụng web và hai cơ sở Firestore, đồng thời tạo bản web ở `dist-staging`. Lệnh này chỉ đọc cấu hình Firebase và build. `npm run build` tiếp tục xuất bản web thông thường vào `dist`.
4. Dùng `npm run stock:staging -- <mã-dự-án-staging> --deploy` để đưa hai bộ Rules và bốn hàm phục vụ kho lên dự án đã kiểm tra. Đưa `dist-staging` lên một miền thử nghiệm riêng đã đăng ký ở bước 1. Trình kiểm tra từ chối mã dự án đang dùng cho website vận hành.
5. Trước khi đăng nhập qua web, quản trị viên staging cấp hồ sơ `legacy/users/<uid>` cho từng tài khoản thử với `uid`, `email`, `displayName`, `role` và `accessStatus: "active"`. Sau đó dùng `bootstrapWorkshop` và `provisionWorkshopMember` với tài khoản chủ xưởng và App Check để cấp quyền theo xưởng. Thử mở kho bằng chủ xưởng và kế toán trước khi ghi số dư đầu.

## Đã thực hiện trong môi trường cập nhật ngày 14/11/2026
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
- Firebase App Check đã đăng ký cho web app `ai-studio-applet-webapp` bằng reCAPTCHA Enterprise; Vercel đã có biến `VITE_FIREBASE_APPCHECK_SITE_KEY` cho Production, Preview và Development.
- Kiểm tra bản Production `https://hethong-nguyendu.vercel.app`: site key đã được đóng gói vào bundle, reCAPTCHA Enterprise tải thành công và không có lỗi console App Check/reCAPTCHA trong lần smoke test.
- **Chưa bật Enforcement.** Firebase Console chưa hiển thị Cloud Firestore là API đủ điều kiện bật Enforcement cho cấu hình hiện tại; tiếp tục quan sát token/yêu cầu hợp lệ trước khi bật để tránh khóa nhầm chấm công và ghi dữ liệu thật.
- Smoke test localhost: mở được Nhân sự, Sản xuất, Kho, Cài đặt; bố cục và menu tại 390×844 hiển thị đúng; không thấy lỗi console trong các luồng đã mở.
- `npm audit` còn advisory gián tiếp từ Firebase/`@grpc/grpc-js` và chuỗi công cụ lint; tại thời điểm kiểm tra chưa có bản vá không phá vỡ tương thích. Không chạy `npm audit fix --force`.
- Firestore Emulator dùng Java 21 di động trong `.tools/java21` và đã chạy thành công. Thư mục công cụ không được đưa lên Git; máy mới có thể dùng Java đã cài hoặc đặt bản di động cùng vị trí.
- **Chưa kiểm tra camera thật hoặc PWA trên Android/iPhone thật.** Cả Rules hiện tại và Rules nhiều xưởng dự thảo đã chạy Emulator, nhưng V2 vẫn cần trusted provisioning, staging và migration được phê duyệt trước Production. Playwright E2E mô phỏng kích thước desktop/mobile không thay thế nghiệm thu thiết bị thật.
- Không chạy migration, deploy Rules V2, deploy Functions hoặc thay đổi dữ liệu đối với Firestore Production. Chỉ cập nhật cấu hình App Check và bản web Vercel.

## Triển khai an toàn
1. Lưu bản ZIP gốc và xuất Firestore Backup từ môi trường có quyền quản trị.
2. So sánh mã thay đổi bằng `git diff` hoặc VS Code Compare với phiên bản gốc.
3. Tải package về máy cục bộ, cài thư viện và chạy đủ test.
4. Dùng một Firebase **staging** khác hoặc Firestore Emulator để kiểm thử rules và cấu trúc dữ liệu.
5. Đưa lên hosting thử (HTTPS), dùng tài khoản thử nghiệm, kiểm tra luồng camera và phân quyền.
   - Cấu hình `VITE_FIREBASE_APPCHECK_SITE_KEY` lúc build web và đăng ký đúng domain staging trong reCAPTCHA Enterprise/Firebase App Check.
   - Kiểm tra Chủ xưởng/Quản lý/Nhân sự/Kế toán nhìn đúng nút trong màn hình Bảng lương Production; thử tạo kỳ, đối soát, duyệt bằng người khác và thanh toán thử.
   - Kho nhựa: làm theo mục chuẩn bị Firebase staging ở trên. Đăng nhập bằng tài khoản chủ xưởng và mở **Kho nhựa → Thiết lập tồn đầu**. Nhập mã, tên, số kg đã kiểm kê và mã biên bản. Đối chiếu tồn đầu, lịch sử và nhật ký trước khi lập phiếu nhập/xuất. Thử gửi lại cùng mã mặt hàng với cùng dữ liệu, từ chối sửa số tồn đầu đã ghi, xuất vượt tồn và quyền chỉ xem của kế toán trước khi bật biến `VITE_WORKSHOP_STOCK_ENABLED` trên bản web vận hành.
6. Chỉ sau nghiệm thu mới lên Production, theo từng module và có phương án rollback. **Không chép Rules dự thảo vào Production.**

## Khôi phục / quay về
- Nếu chỉ cập nhật mã nguồn: quay về mã nguồn gốc từ ZIP đã lưu và triển khai lại giao diện.
- Nếu đã thay đổi dữ liệu Firestore ở bước sau: chỉ khôi phục từ bản sao lưu Firestore tương ứng được xác minh; không dùng localStorage DEMO để khôi phục dữ liệu Production.
- Nếu PWA dùng cache phiên bản cũ: tải lại, kiểm tra service worker/caches; người dùng có thể phải mở lại ứng dụng để nhận tài nguyên mới.
