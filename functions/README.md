# Trusted backend – Phase 4B và 4D

Bộ Cloud Functions thế hệ 2 này là nền tảng máy chủ cho mô hình nhiều tài khoản theo xưởng. Mã đã được xây dựng nhưng **chưa triển khai**.

## Chức năng

- `bootstrapWorkshop`: tạo xưởng đầu tiên, owner membership và con trỏ UID theo một giao dịch.
- `provisionWorkshopMember`: owner cấp thành viên sau khi UID/email đã tồn tại và email đã xác minh trong Firebase Authentication.
- `applyWorkshopMigration`: kiểm tra lại gói xem trước, chặn dữ liệu sinh trắc học, giới hạn 200 bản ghi, tạo backup và ghi idempotent trong một transaction.
- `rollbackWorkshopMigration`: chỉ hoàn tác nếu toàn bộ bản ghi chưa bị chỉnh sửa sau migration; nếu có thay đổi sẽ dừng để tránh ghi đè.
- `transitionPayrollPeriod`: gửi duyệt, duyệt và chốt kỳ lương theo đúng vai trò; người gửi không được tự duyệt.
- `payPayrollPeriod`: thanh toán một phần hoặc tất toán; cập nhật kỳ lương, phiếu thanh toán, sổ chi và audit trong cùng transaction, chống gửi lại hai lần.
- `postStockMovement`: nhập/xuất tồn kho theo đơn vị gram nguyên; chặn xuất vượt tồn, mã biến động trùng và một chứng từ nguồn đồng bộ hai lần.

Tất cả callable đều yêu cầu Firebase Authentication, email đã xác minh, App Check và limited-use token chống phát lại. Membership, migration job và audit được ghi bằng Admin SDK.

## Kiểm tra cục bộ

```text
npm install
npm test
npm run build
npm run test:integration # chỉ chạy khi Firestore Emulator đã được khởi động
```

## Điều kiện trước staging

1. Tạo dự án Firebase staging riêng và sao lưu dữ liệu nguồn.
2. Bật App Check cho web; chưa bật enforcement cho người dùng thật cho tới khi đo tỷ lệ token hợp lệ.
3. Cấu hình `BOOTSTRAP_ADMIN_EMAILS` trong môi trường triển khai, không ghi email thật vào Git.
4. Deploy Functions bằng `--only functions` vào staging; không deploy toàn bộ dự án vì Rules V2 vẫn là tệp dự thảo riêng.
5. Chạy migration nhỏ, kiểm tra audit/backup, thử rollback, sau đó mới nghiệm thu nhiều tài khoản.
