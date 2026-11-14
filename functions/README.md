# Trusted backend – Phase 4B, 4C và 4D

Bộ Cloud Functions thế hệ 2 này là nền tảng máy chủ cho mô hình nhiều tài khoản theo xưởng. Mã đã được xây dựng nhưng **chưa triển khai**.

## Chức năng

- `bootstrapWorkshop`: tạo xưởng đầu tiên, owner membership và con trỏ UID theo một giao dịch.
- `provisionWorkshopMember`: owner cấp thành viên sau khi UID/email đã tồn tại và email đã xác minh trong Firebase Authentication.
- `applyWorkshopMigration`: kiểm tra lại gói xem trước, chặn dữ liệu sinh trắc học, giới hạn 200 bản ghi, tạo backup và ghi idempotent trong một transaction.
- `rollbackWorkshopMigration`: chỉ hoàn tác nếu toàn bộ bản ghi chưa bị chỉnh sửa sau migration; nếu có thay đổi sẽ dừng để tránh ghi đè.
- `generatePayrollPeriod`: tạo kỳ lương nháp từ cặp vào/ra đã duyệt, khóa từng sự kiện công để không tính sang kỳ khác; dừng tạo kỳ nếu còn công thiếu cặp và đánh dấu dòng tăng ca/sản lượng phải đối soát.
- `adjustPayrollItem`: đối soát tăng ca, sản lượng nghiệm thu, phụ cấp, thưởng, tạm ứng và khấu trừ trên kỳ nháp; cập nhật dòng lương, tổng kỳ, khóa kiểm tra và audit trong cùng transaction.
- `transitionPayrollPeriod`: gửi duyệt, duyệt và chốt kỳ lương theo đúng vai trò; người gửi không được tự duyệt.
- `payPayrollPeriod`: thanh toán một phần hoặc tất toán; cập nhật kỳ lương, phiếu thanh toán, sổ chi và audit trong cùng transaction, chống gửi lại hai lần.
- `createProductionBatch`: lập mẻ từ máy, phiếu cân đã duyệt và ba mặt hàng đầu vào/thành phẩm/phế phẩm; chỉ lưu chờ duyệt, chưa thay đổi kho.
- `reviewProductionBatch`: quản lý khác người lập duyệt hoặc hủy mẻ; khi duyệt sẽ trừ nguyên liệu, cộng thành phẩm/phế phẩm, khóa phiếu cân và cập nhật sản lượng máy trong cùng transaction.
- `postStockMovement`: nhập/xuất tồn kho theo đơn vị gram nguyên; chặn xuất vượt tồn, mã biến động trùng và một chứng từ nguồn đồng bộ hai lần.

Tất cả callable đều yêu cầu Firebase Authentication, email đã xác minh, App Check và limited-use token chống phát lại. Membership, migration job và audit được ghi bằng Admin SDK.

Sự kiện công dùng để tạo lương phải có `workDate` dạng `YYYY-MM-DD`, `timeMinutes` từ 0–1439, `eventType` là `check_in`/`check_out` và `approvalStatus: approved`. Backend không tạo kỳ khi còn sự kiện thiếu cặp; kỳ có tăng ca hoặc lương sản lượng được giữ ở bản nháp và không thể gửi duyệt tới khi từng dòng đã được đối soát có lý do.

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
