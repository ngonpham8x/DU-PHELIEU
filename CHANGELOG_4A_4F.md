# CHANGELOG – Dư-Nhựa phế liệu Phase 4A–4F (bản phát triển)

## Tổng quan
- Giữ nguyên mã nguồn gốc của React/Vite, logo/sidebar và nghiệp vụ Thu – Chi.
- Mở rộng bằng các module riêng `src/modules/phase4b`, `phase4c`, `phase4d`, `phase4e`, tránh thay toàn bộ màn hình.
- Dữ liệu của các module mới chỉ ở **DEMO/localStorage**, Production không tự ghi. Không có migration hoặc thay đổi Firestore ngoài môi trường trong lượt làm việc này.

## Cập nhật giao diện responsive và nhận diện mặc định
- Xác minh `C:/Users/Admin/Downloads/logo-horizontal.svg` trùng hoàn toàn với `public/logo-horizontal.svg`; dùng SVG này làm logo ngang mặc định tại sidebar mở rộng, Trang chủ, trang offline và ảnh chia sẻ web.
- Giữ icon vuông cùng huy hiệu thương hiệu cho favicon/PWA Android/iOS để hệ điều hành không cắt hỏng logo ngang.
- Thêm `ResponsiveTableEnhancer`: mọi bảng legacy và module lazy-load đều có vùng cuộn ngang trên desktop/tablet và tự chuyển từng dòng thành thẻ có nhãn cột dưới 768px.
- Kiểm tra thực tế bảng Cân nhựa: nội dung rộng 1.402px cuộn trong vùng 990px; mobile 390×844 hiển thị thẻ đúng và không có lỗi console.

## Thay đổi từng Phase

### 4A – Ổn định
- Kế thừa bản 4B bước đầu đã sửa role tự đăng ký; giữ `firestore.rules` không triển khai khi chưa chạy Emulator.
- Chặn thực thi nút chuyển đổi nhãn mủ thành loại nhựa ngẫu nhiên; giữ màn hình đối chiếu, sao lưu để kiểm tra sau.
- Khóa các thao tác cập nhật danh mục nhựa, máy, mẻ băm, kho bằng localStorage ở Production.

### 4B – Nhân sự & lương
- `EmployeeManagerDemo.tsx`: thêm/sửa hồ sơ, ngừng làm việc, không xóa vĩnh viễn.
- `ProductionMigrationPreview.tsx`: chủ xưởng xem trước chuyển nhân viên/ca làm sang mô hình nhiều tài khoản, kiểm tra mã xưởng, mã trùng, ca thiếu và đơn giá sai; xuất JSON đối soát nhưng không ghi Firestore. Mọi mẫu/hash sinh trắc học cũ đều bị loại và hồ sơ đã đăng ký mặt được đánh dấu phải đăng ký lại.
- `functions/`: backend Cloud Functions thế hệ 2 cho bootstrap xưởng, cấp membership, áp dụng migration tối đa 200 bản ghi có backup/idempotency và rollback an toàn. Tất cả callable yêu cầu Auth, email xác minh, App Check/replay protection; cấu hình bootstrap không hardcode trong Git. Bộ domain đạt **8/8** và không có advisory Production trong package Functions; mới build/test cục bộ, **chưa deploy**.
- Luồng chấm công Camera trong DEMO tự nhận diện nhân viên đã đăng ký, hiển thị tên/mã/bộ phận/giờ hiện tại, tự đề xuất **VÀO CA** hoặc **RA CA** theo lịch sử trong ngày và chỉ cho xác nhận sau khi nhận diện đạt.
- Mỗi lần mở Camera, nhận diện, lưu thành công hoặc lỗi đều có mã vết riêng trong “Dấu vết chống mất công”. Dấu vết được giữ ngay trên thiết bị để quản lý truy lại; lỗi ghi máy chủ không còn bị coi nhầm là thành công và tự chuyển sang luồng bổ sung chấm công chờ duyệt.
- Dấu vết không lưu ảnh khuôn mặt. Nhận diện sinh trắc học thật vẫn bị khóa ở Production cho tới khi có nhà cung cấp, liveness, mẫu khuôn mặt đã đăng ký và quy trình bảo vệ dữ liệu được nghiệm thu.
- `PayrollWorkflowDemo.tsx` và `payrollDomain.ts`: kỳ lương DEMO, chỉnh các thành phần lương, tạm ứng, thưởng, phụ cấp; chuyển trạng thái nháp → duyệt → chốt; trả lương một phần và trọn kỳ; xuất ExcelJS (.xlsx).
- Phiếu chi lương **DEMO** gắn với Sổ Thu – Chi qua callback của App. Mã thanh toán riêng được kiểm tra chống ghi lại cùng mã.
- Sau chốt không sửa bảng lương, báo cáo chưa thể ghi vào Firestore Production.

### 4C – Cân nhựa & sản xuất
- `productionDomain.ts`: kiểm tra cân bằng nguyên liệu/đầu ra/hao hụt, cảnh báo trên 10% (mức gợi ý, phải xác lập theo thực tế), phát hiện trùng mã phiếu.
- `FactoryOpsDemo.tsx`: lịch bảo trì máy băm (Mài dao, Thay dao, Sửa chữa) và đánh dấu hoàn thành DEMO.
- Bảng Cân nhựa min-width phù hợp + cuộn ngang, tên đối tác rút gọn có title để không vỡ dòng thành chiều dọc.
- Bổ sung callable lập mẻ chờ duyệt và duyệt/hủy mẻ theo vai trò; người lập không được tự duyệt. Khi duyệt, máy chủ đối chiếu phiếu cân rồi trừ nguyên liệu, cộng thành phẩm/phế phẩm, khóa nguồn, cập nhật máy và ghi audit trong cùng transaction.
- Phiếu cân đã quyết toán không thể dùng lại; gửi lại yêu cầu duyệt đã hoàn tất không làm biến động kho lần hai.

### 4D – Kho & báo cáo
- `stockDomain.ts`: nhập/xuất tạo biến động có before/after; chặn xuất vượt tồn và trùng sourceId trong một mặt hàng.
- `StockLedgerPanel.tsx`: nhật ký thao tác mới phát sinh, kiểm tra tồn âm, xuất ExcelJS (.xlsx), báo cáo tổng hợp nguồn tiền/cân/sản xuất.
- Chưa tự hạch toán kho từ phiếu cân hoặc mẻ băm vì chưa có liên kết sourceId thật, tránh cộng trùng.

### Nâng cấp xuất ExcelJS toàn hệ thống
- Thay toàn bộ chức năng xuất bảng dữ liệu ở Sổ Thu–Chi, Chấm công, Bảng lương và Kho nhựa sang tệp Excel `.xlsx` thực.
- Mỗi tệp có trang dữ liệu và tổng hợp riêng, tiêu đề, bộ lọc, cố định hàng đầu, định dạng ngày giờ, số và tiền Việt Nam.
- Tự điều chỉnh độ rộng cột, tô màu xen kẽ và tối ưu trang in ngang để dễ xem trên nhiều thiết bị.
- Dữ liệu văn bản bắt đầu bằng ký tự công thức được vô hiệu hóa trước khi ghi vào Excel để tránh thực thi công thức ngoài ý muốn.
- ExcelJS được tải riêng khi người dùng bấm xuất, không làm nặng phần tải ban đầu của ứng dụng.

### Hoàn thiện giao diện thích ứng và bản in chấm công
- Menu trái chuyển sang cố định toàn chiều cao màn hình, không còn cuộn mất danh mục hoặc để khoảng trắng khi trang dài.
- Thanh điều khiển đầu trang tự ẩn tiêu đề/nút phụ ở chiều rộng trung gian để không chồng chữ.
- Mọi bảng có lựa chọn **Tự động / Dạng bảng / Dạng thẻ**; chế độ Tự động dựa trên độ rộng thật của khung bảng, mobile ưu tiên dạng thẻ.
- Bản in chấm công dùng mẫu riêng: mỗi nhân viên/ngày công nằm trọn trên một trang A4, có tên và khu vực ký xác nhận; không in các khung thao tác, cảnh báo dự phòng hoặc cấu hình ca.
- Các phân hệ chưa sẵn sàng Production chỉ dùng một cảnh báo chung, không lặp nhiều khung và không hiển thị dữ liệu DEMO bên dưới.
- Phần so sánh bộ nhận diện/logo trong Cài đặt được ẩn mặc định và chỉ mở khi người dùng yêu cầu.

### Tiếp tục backend Phase 4B, 4C và 4D
- Thêm callable máy chủ gửi duyệt, duyệt và chốt kỳ lương theo vai trò; người lập không được tự duyệt.
- Thanh toán lương cập nhật kỳ, phiếu trả lương, sổ chi và audit trong một transaction; hỗ trợ trả một phần/tất toán và gửi lại an toàn không trừ hai lần.
- Thêm callable nhập/xuất kho theo số gram nguyên, ghi số dư trước/sau, chặn xuất vượt tồn và khóa mỗi chứng từ nguồn chỉ được đồng bộ một lần.
- Bổ sung Rules V2 cho mặt hàng kho, máy, phiếu cân, mẻ sản xuất và khóa chứng từ; client chỉ đọc theo vai trò và không được tự ghi ledger.
- Thêm kiểm thử Firestore Emulator cho các transaction tài chính/kho/sản xuất; chưa triển khai các callable này lên staging hoặc Production.

### 4E – Bảo mật & PWA
- `ReleaseReadiness.tsx`: checklist xem các điều kiện bắt buộc trước Production.
- Đổi tài khoản bootstrap Chủ xưởng/Quản trị hệ thống sang `nguyenvandu1990mc@gmail.com`; cấu hình `tayninhdoimoi@gmail.com` là quản trị viên khẩn cấp có kiểm toán, không tạo tài khoản ẩn/cửa hậu.
- Production chuyển sang **khóa mặc định**: chỉ hai quản trị viên bootstrap hoặc hồ sơ người dùng có đúng email và `accessStatus: active` mới được truy cập. Tài khoản lạ bị đăng xuất và ghi một sự kiện `security_events` cố định theo UID để chống spam log.
- Chủ xưởng nhận banner/toast khi có sự kiện truy cập lạ; đăng nhập lặp quá 5 lần trong 10 phút bị giới hạn trên thiết bị. Bản Production không đưa email/chi tiết Firebase nhạy cảm ra console; Google luôn yêu cầu chọn lại tài khoản.
- `public/sw.js`: chỉ cache tài nguyên tĩnh; tránh cache dữ liệu nghiệp vụ/API.
- `public/offline.html`: thông báo rõ không cho ghi nghiệp vụ khi offline.
- `docs/FIRESTORE_WORKSHOP_V2_DRAFT.rules`: dự thảo phân quyền theo `workshopId`, **không dùng thay Rules hiện tại**.
- Gia cố Rules V2 dự thảo: membership active phải khớp UID/email token, con trỏ `user_workshops` chỉ máy chủ cấp, dữ liệu giữa hai xưởng bị cách ly, nhân viên chỉ xem công/lương của mình, ledger/mẻ sản xuất và membership chỉ backend được ghi. Rules giữ dấu vết migration không cho client xóa. Bộ Emulator riêng cho V2 đạt **10/10**, nhưng vẫn chưa triển khai Production.
- Sửa metadata không quảng cáo xác minh khuôn mặt đã hoàn thành nếu vẫn DEMO.

### 4F – Kiểm thử & bàn giao
- Bổ sung kiểm thử chọn đúng VÀO CA/RA CA, chính sách tài khoản/giới hạn đăng nhập và gói xem trước chuyển nhân sự; tổng hiện tại **53/53 PASS**.
- Bổ sung Playwright E2E trên Chromium desktop và mobile: kiểm tra điều hướng DEMO, khung chính sách tài khoản đã được gỡ, thanh cuộn ngang phía trên đồng bộ với bảng và dạng thẻ mobile không tạo cuộn thừa; **4 bài đạt, 2 trường hợp không áp dụng được bỏ qua đúng cấu hình**.
- Bổ sung Firestore Emulator bằng Java 21 di động, không kết nối dự án thật. Bộ Rules Production hiện tại đạt **7/7 tình huống tích hợp** về xác thực, hai quản trị viên bootstrap, tài khoản lạ, phân quyền kế toán/nhân viên, tài khoản đình chỉ và nhật ký bất biến. Bản Rules nhiều xưởng trong `docs/` vẫn chỉ là dự thảo, chưa được nghiệm thu.
- Đã cài đầy đủ dependency bằng npm và tạo `package-lock.json`; sửa xung đột `esbuild`/Vite và hạ TypeScript về nhánh tương thích với bộ lint hiện tại.
- `npm run lint`, `npm run lint:rules`, `npm test` và `npm run build` đều đạt; thêm lệnh tổng hợp `npm run check`.
- Sửa một nhánh điều kiện camera không thể xảy ra làm TypeScript báo lỗi, nhưng vẫn giữ nguyên khóa nhận diện giả lập ở Production.
- Tách tải các màn hình Phase 4 và modal lớn bằng `React.lazy`; build tạo chunk riêng theo chức năng thay vì dồn toàn bộ vào một file.
- Loại bỏ 4 dependency không được mã nguồn sử dụng (`@google/genai`, `dotenv`, `express`, `@types/express`), giảm 114 package cài đặt.
- Đã mở kiểm tra runtime trên localhost: Nhân sự, Sản xuất, Kho, Cài đặt, menu mobile 390×844; không có lỗi console tại các luồng đã kiểm tra.
- **Chưa kiểm tra Firebase Emulator, camera thật, iOS/Android thật hoặc giao dịch Production.** Đã kiểm tra đầy đủ luồng nhận diện mô phỏng trên localhost: hiện đúng Nguyễn Văn Hùng, lưu VÀO CA và tự đề xuất RA CA ở lượt kế tiếp. `npm audit` vẫn báo advisory gián tiếp từ Firebase/gRPC và công cụ lint chưa có bản vá tự động an toàn.
- Có tài liệu vận hành, giới hạn nghiệm thu, phương án rollback và lộ trình hoàn thiện Production.

## Điều kiện quan trọng
**Đây là bản triển khai module DEMO để tiếp tục phát triển, không phải bản Production hoàn chỉnh.** Không tự deploy rules hoặc thay thế dữ liệu thật khi chưa có sao lưu, staging, kiểm thử multi-user và phê duyệt thay đổi.
