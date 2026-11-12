# Phase 4E – An toàn, quyền hạn và PWA

## Đã cập nhật trong mã nguồn bản này
- Service worker chỉ cache tài nguyên tĩnh, không cache giao dịch tài chính, hồ sơ nhân sự, API hoặc dữ liệu Firebase.
- Có màn hình `/offline.html`. Offline **không ghi công, ghi tiền, ghi kho**.
- Module Nhân sự, Kỳ lương, Bảo trì và Thẻ kho mới chạy DEMO, không tự ghi Firebase Production.
- Các nguồn demo mới có khoá localStorage riêng, không đổi schema hay UID hiện có.
- Firestore Rules hiện tại giữ nguyên từ bản 4B: thay đổi schema thật cần triển khai ở môi trường kiểm thử trước.

## Chưa được xem là an toàn Production
1. `firestore.rules` cũ sử dụng email hardcode để bootstrap Owner; phải cấp trusted custom claims trước khi bỏ cơ chế cũ, nếu không có thể khóa tài khoản.
2. Quyền legacy dựa `ownerId == request.auth.uid`, chưa có membership xưởng nhiều tài khoản. Phải có workflow migrate duyệt trước + sao lưu.
3. Các giao dịch thanh toán và kho muốn an toàn phải được ghi ở backend trong một transaction, có request ID ổn định, audit log từ server và kiểm tra permission phía server.
4. Nhận diện khuôn mặt 1:1 vẫn chỉ DEMO. Không lưu hoặc dùng mẫu sinh trắc học thật khi chưa có dịch vụ đáng tin cậy, đánh giá riêng tư và cơ chế thay thế.
5. Chưa thử PWA trên thiết bị Android và iPhone thật, chưa chạy Firebase Emulator trên bộ Rules mới.

## Mô hình dự thảo cho tương lai
`docs/FIRESTORE_WORKSHOP_V2_DRAFT.rules` **không tự triển khai**. Đây là điểm khởi đầu để thiết kế `workshops/{wid}/members/{uid}`, `employees`, `shifts`, `payroll`, `cash`, `stock`, audit bảo vệ theo workshopId. Mọi membership được ghi bởi Admin SDK hoặc quy trình mời có xác minh; client không được tự cấp quyền.

## Các case Emulator bắt buộc
- Worker mới không được tự tạo `owner`, `manager`, `accountant`.
- Worker A không được đọc lương của worker B hoặc tiền quỹ.
- Hai thành viên cùng một xưởng đúng quyền phải xem dữ liệu chung.
- Thành viên xưởng B không được đọc dữ liệu xưởng A.
- Chủ xưởng không được sửa trực tiếp giao dịch đã khóa.
- Người dùng không thể tự ghi audit, `actorUid` giả hoặc sửa approval status.
- Không thể tạo hai phiếu chi với cùng idempotency key hoặc xuất kho vượt tồn.
