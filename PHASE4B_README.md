# Dư-Nhựa phế liệu — bàn giao bản chỉnh sửa bước đầu Phase 4B

**Phạm vi:** chỉnh sửa bản sao của tệp ZIP người dùng gửi. **Không triển khai Firebase Production**, không truy cập tài khoản thật.

## 1. Những gì đã kiểm tra trong mã nguồn

- Ứng dụng Vite / React 19 / TypeScript, Firebase Auth và Firestore.
- Sidebar, thu chi, nhật ký, cân nhựa, chấm công, kho/sản xuất đã có giao diện.
- `src/App.tsx` có nhân sự, ca làm, nhựa, máy móc, tồn kho lưu `localStorage` trong cả các phiên Production — chưa đủ cơ sở cho dữ liệu dùng chung.
- Firebase query cũ sử dụng `where('ownerId','==', firebaseUser.uid)` nên **mỗi UID một bộ dữ liệu**, chưa hỗ trợ đơn vị chủ quản nhiều tài khoản; không tự đổi UID hoặc ownerId.
- `verifyFace1To1` chỉ là mô phỏng thuật toán, không có AI sinh trắc học đáng tin cậy; giao diện phát camera không đồng nghĩa với chấm công khuôn mặt thật.
- `firestore.rules` cũ cho phép đăng ký role tự chọn (trừ owner), do đó có nguy cơ tài khoản tự tạo manager/accountant.

## 2. Các sửa đổi thực tế trong bản ZIP này

- `src/App.tsx`: đăng nhập đọc vai trò có sẵn từ `/users/{uid}`; tài khoản mới chỉ tự tạo vai trò `worker`, không tự phong `manager` theo email; thất bại đọc quyền mặc định `worker` (fail-closed). Chuyển sang Prod sẽ đọc lại vai trò từ Firestore.
- `src/components/AppShell.tsx` và Cài đặt: khóa ô chọn mô phỏng vai trò ở Production, vẫn hoạt động trong DEMO.
- `firestore.rules`: tài khoản mới chỉ được tự đăng ký `worker` (hoặc do quản trị hiện có tạo); bản ghi nhật ký không được giả UID/role người khác. **Các quy tắc mới chưa được triển khai**; cần kiểm tra qua Firebase Emulator trước.
- `src/components/QuickModals.tsx`: không cho thuật toán nhận diện khuôn mặt giả ghi `face_verified` trong Production, kể cả khi video webcam thật đang phát.
- `src/App.tsx`: chặn ghi chấm công Production khi chưa có hồ sơ nhân viên đáng tin cậy trong Firestore; hiển thị cảnh báo rõ ràng. Luồng chấm công DEMO vẫn giữ để kiểm tra giao diện.
- `src/App.tsx`: chặn đăng ký/thu hồi mẫu sinh trắc học giả trong Prod; bảng nhân sự Prod không coi danh sách DEMO trong localStorage là nhân sự thật; chặn tác vụ tự chuyển dữ liệu mủ→nhựa lên Prod.
- `src/data/demoSeed.ts`: ngày hiển thị hiện hành được lấy theo múi giờ Asia/Ho_Chi_Minh, không cố định 11/11/2026.
- `metadata.json`: thay tên cũ để đồng nhất thương hiệu Dư-Nhựa phế liệu.
- `src/utils/payroll.ts`, `src/components/PayrollPreview.tsx`, `src/utils/payroll.test.ts`: **bổ sung tính lương dự kiến trong DEMO** tại mục Nhân sự, dùng các cặp vào/ra ca hợp lệ, tính ngày/giờ/tháng/sản lượng, tăng ca, thưởng, tạm ứng, khấu trừ. Không tự ghi phiếu chi hay bảng lương vào dữ liệu thật.

## 3. Cách chạy (VS Code hoặc terminal)

```sh
npm install
npm run dev
```

Truy cập địa chỉ localhost Vite hiển thị trên terminal. Xem **Nhân sự → Bảng tính lương dự kiến – Phase 4B**. Đổi sang DEMO trước khi kiểm tra dữ liệu mẫu.

Kiểm tra sau khi cài thư viện:

```sh
npm run lint
npm test
npm run build
```

**Cập nhật kiểm thử 12/11/2026:** npm đã cài thành công; `npm run check` đạt gồm TypeScript, Firestore Rules lint, 47/47 bài kiểm thử logic và Vite production build. Production đã khóa tài khoản chưa được cấp trước, có cảnh báo truy cập lạ và giới hạn spam đăng nhập trên thiết bị. Luồng chấm công DEMO đã được kiểm tra trực tiếp trên localhost: tự hiện đúng nhân viên, lưu VÀO CA, lượt tiếp theo đề xuất RA CA và có mã vết truy lại. Vẫn chưa có kết quả Firebase Emulator, webcam thật hoặc thiết bị Android/iPhone thật; không được coi bản này là Production-ready.

## 4. Việc bắt buộc trước khi triển khai Production

1. Sao lưu Firestore và xuất file gốc nguyên trạng. Không nạp dự án này trực tiếp lên Prod chưa kiểm thử.
2. Chuyển dữ liệu nhân sự/ca sang mô hình `workshops/{workshopId}/employees`, `shifts`… với membership/roles xác nhận từ server, migration có preview/dedupe/rollback. Kiểm tra đồng bộ hai UID cùng xưởng.
3. Đánh giá cách bootstrap chủ xưởng trong Security Rules: hiện vẫn tồn tại điều kiện email quản trị hardcode để tương thích hệ thống cũ. **Không xóa ngay** nếu chưa tạo cơ chế admin trusted claims, tránh khóa tài khoản chủ xưởng.
4. Firestore Rules cần được thử với Firebase Emulator thật: thử tạo `manager` từ tài khoản chưa cấp quyền phải bị từ chối; actorUid giả trong audit log phải bị từ chối; worker không xem tiền và lương người khác.
5. Kiểm tra và thiết kế `payroll_periods`, `payroll_items`, `payroll_advances`, `payroll_payments` theo workshopId; cần đối soát đủ 2 bước *duyệt/chốt lương* và *thực trả tiền* mới tạo phiếu chi duy nhất.
6. Chưa có dịch vụ nhận diện sinh trắc học thật. Giữ chấm công khuôn mặt Production ở trạng thái chưa hỗ trợ; chỉ mở sau khi tích hợp hệ thống xác minh an toàn, bảo vệ dữ liệu cá nhân, có phương án chấm công thay thế.
7. Xác nhận dữ liệu lịch sử mủ cao su có đúng là dữ liệu nhựa phế liệu hay không; **không được tự gán mủ chén = HDPE, mủ nước = PET** vào hồ sơ thật.

## 5. Lộ trình tiếp theo

- **4B tiếp:** Lưu hồ sơ nhân sự + ca làm lên Firestore theo quyền nhiều người dùng; bảng lương có trạng thái nháp → chờ duyệt → chốt → thanh toán; không được phát sinh phiếu chi trùng.
- **4C:** Đối soát cân nhựa, nhập kho, mẻ băm, xuất kho theo một nhật ký phát sinh tồn kho; không dùng localStorage làm kho Production.
- **4D:** Báo cáo, nhật ký đối soát, công nợ, in ấn, xuất dữ liệu.
- **4E:** Chạy emulator/security/E2E thật và cải thiện PWA, camera trên thiết bị.

**Giữ bản ZIP gốc riêng** để quay lui. Không sử dụng chức năng khôi phục/migration DEMO cho dữ liệu Production.
