import { expect, test, type Page } from '@playwright/test';

async function openSidebarPage(page: Page, id: string) {
  const mobileMenu = page.getByTestId('mobile-hamburger-btn');
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByTestId(`sidebar-item-${id}`).click();
}

test.describe('Phase 4F – kiểm tra giao diện DEMO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('page-home')).toBeVisible({ timeout: 15_000 });
  });

  test('Cài đặt có xem trước chuyển dữ liệu và không còn khung chính sách', async ({ page }) => {
    await openSidebarPage(page, 'settings');
    await expect(page.getByTestId('page-settings')).toBeVisible();
    await expect(page.getByTestId('security-account-policy')).toHaveCount(0);
    await expect(page.getByText('Chính sách tài khoản quản trị và chống xâm nhập')).toHaveCount(0);

    const migrationPreview = page.getByTestId('production-migration-preview');
    await expect(migrationPreview).toBeVisible();
    await expect(migrationPreview).not.toHaveAttribute('open', '');
    await migrationPreview.locator('summary').click();
    await page.getByTestId('migration-workshop-id').fill('mã xưởng có dấu');
    await expect(migrationPreview.getByText(/Mã xưởng phải dài/)).toBeVisible();
    await page.getByTestId('migration-workshop-id').fill('du_nhua_01');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-migration-preview').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('XemTruoc_ChuyenNhanSu_DuNhua.json');

    await expect(page.getByTestId('brand-identity-details')).toHaveCount(0);
    await page.getByTestId('toggle-brand-identity-details').click();
    await expect(page.getByTestId('brand-identity-details')).toBeVisible();
    await page.getByTestId('toggle-brand-identity-details').click();
    await expect(page.getByTestId('brand-identity-details')).toHaveCount(0);
  });

  test('bảng rộng có thanh cuộn phía trên và đồng bộ với bảng', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Chỉ kiểm tra thanh cuộn bảng trên desktop');

    await openSidebarPage(page, 'weighing');
    await expect(page.getByTestId('page-weighing')).toBeVisible();

    const topScrollbar = page.locator('.responsive-table-scroll-top:visible').first();
    await expect(topScrollbar).toBeVisible();

    const dimensions = await topScrollbar.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);

    await topScrollbar.evaluate((element) => {
      element.scrollLeft = 160;
      element.dispatchEvent(new Event('scroll'));
    });

    await expect.poll(() => topScrollbar.evaluate((element) => {
      const tableShell = element.nextElementSibling as HTMLElement | null;
      return tableShell?.scrollLeft || 0;
    })).toBeGreaterThan(0);
  });

  test('mobile dùng dạng thẻ và không hiện thanh cuộn thừa', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chromium', 'Chỉ kiểm tra dạng thẻ trên mobile');

    await openSidebarPage(page, 'weighing');
    await expect(page.getByTestId('page-weighing')).toBeVisible();

    const table = page.getByTestId('weighing-table');
    await expect(table).toBeVisible();
    await expect(table).toHaveCSS('display', 'block');
    await expect(page.locator('.responsive-table-scroll-top').first()).toBeHidden();

    await page.getByRole('button', { name: 'Dạng bảng' }).first().click();
    await expect(table).toHaveAttribute('data-view-mode', 'table');
    await expect(table).toHaveCSS('display', 'table');

    await page.getByRole('button', { name: 'Tự động' }).first().click();
    await expect(table).toHaveAttribute('data-card-layout', 'true');
  });

  test('menu cố định, thanh đầu trang không chồng chữ và bảng theo độ rộng khung', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Chỉ kiểm tra cửa sổ desktop co hẹp');
    await page.setViewportSize({ width: 900, height: 700 });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.getByTestId('primary-sidebar').evaluate((element) => Math.round(element.getBoundingClientRect().top))).toBe(0);
    await expect(page.getByTestId('header-page-title')).toBeHidden();

    const headerFits = await page.getByTestId('top-content-header').evaluate((header) => {
      const headerBox = header.getBoundingClientRect();
      const children = Array.from(header.children).map((child) => child.getBoundingClientRect());
      return children.every((box) => box.left >= headerBox.left && box.right <= headerBox.right + 1);
    });
    expect(headerFits).toBe(true);

    await openSidebarPage(page, 'attendance');
    const fallbackTable = page.getByTestId('fallback-requests-table');
    await expect(fallbackTable).toHaveAttribute('data-card-layout', 'true');
    await expect(fallbackTable).toHaveCSS('display', 'block');
  });

  test('bản in chấm công tạo trang riêng và không cắt nội dung từng nhân viên', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Chỉ kiểm tra bố cục in một lần');
    await openSidebarPage(page, 'attendance');
    await expect(page.getByTestId('page-attendance')).toBeVisible();
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByTestId('fallback-approval-section')).toBeHidden();
    const printPages = page.locator('[data-testid^="print-timesheet-page-"]');
    expect(await printPages.count()).toBeGreaterThan(1);
    await expect(printPages.first()).toBeVisible();
    await expect(printPages.first()).toHaveCSS('page-break-inside', 'avoid');
    await expect(printPages.first()).toContainText('Mã nhân viên:');
  });

  test('chấm công thủ công kiểm tra giờ, giữ mã vết sau tải lại và không mở camera', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false });
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: () => {
          sessionStorage.setItem('e2e-camera-requested', 'true');
          return Promise.reject(new Error('Unexpected camera request'));
        },
      });
    });
    await page.reload();
    await page.getByTestId('quick-btn-attendance').click();
    await expect(page.getByTestId('tab-mode-fallback')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('fallback-date-input').fill('31/02/2026');
    await page.getByTestId('fallback-time-input').fill('08:00');
    await page.getByTestId('fallback-reason-input').fill('Bổ sung giờ vào ca');
    await page.getByTestId('submit-attendance-btn').click();
    await expect(page.getByTestId('attendance-error-alert')).toContainText('Nhập ngày hợp lệ');

    await page.getByTestId('fallback-date-input').fill('01/10/2026');
    await page.getByTestId('submit-attendance-btn').click();
    const result = page.getByTestId('attendance-success-card');
    await expect(result).toContainText('Chờ duyệt');
    const attemptId = (await result.innerText()).match(/ATTEMPT-[A-Z0-9]+-[A-Z0-9]+/)?.[0];
    expect(attemptId).toBeTruthy();

    await page.getByTestId('attendance-next-btn').click();
    await expect(page.getByTestId('fallback-request-form')).toBeVisible();
    await expect(page.getByTestId('fallback-reason-input')).toHaveValue('');
    expect(await page.evaluate(() => sessionStorage.getItem('e2e-camera-requested'))).toBeNull();

    await page.reload();
    await expect(page.getByTestId('page-home')).toBeVisible();
    await openSidebarPage(page, 'attendance');
    await expect(page.getByTestId('fallback-requests-table')).toContainText(attemptId!);
    await expect(page.getByTestId('attendance-attempt-traces')).toContainText(attemptId!);
  });

  test('đổi qua thủ công trong lúc xin quyền sẽ giải phóng camera đến muộn', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Chỉ cần kiểm tra vòng đời camera một lần');
    await page.evaluate(() => {
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
        value: () => new Promise<MediaStream>((resolve) => {
          window.addEventListener('e2e-release-camera', () => {
            const track = { stop: () => sessionStorage.setItem('e2e-camera-stopped', 'true') };
            resolve({ getTracks: () => [track] } as unknown as MediaStream);
          }, { once: true });
          sessionStorage.setItem('e2e-camera-requested', 'true');
        }),
      });
    });

    await page.getByTestId('quick-btn-attendance').click();
    await page.getByTestId('tab-mode-camera').click();
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e-camera-requested'))).toBe('true');
    await page.getByTestId('tab-mode-fallback').click();
    await page.evaluate(() => window.dispatchEvent(new Event('e2e-release-camera')));

    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('e2e-camera-stopped'))).toBe('true');
    await expect(page.getByTestId('fallback-request-form')).toBeVisible();
  });

  test('kho mở lịch sử khi phát sinh biến động và giữ nút Excel ở đầu trang', async ({ page }, testInfo) => {
    const inventory = page.getByTestId('page-inventory');
    const ledger = page.getByTestId('stock-ledger-demo');
    await openSidebarPage(page, 'inventory');
    await expect(inventory.getByTestId('export-stock-excel-btn')).toBeVisible();
    await expect(ledger).toHaveCount(0);

    await page.getByTestId('btn-toggle-inventory-form').click();
    const form = page.getByTestId('inventory-movement-form');
    await form.getByLabel('Số lượng (kg / Cái) *').fill('10');
    await form.getByRole('button', { name: 'Xác Nhận Cập Nhật Kho' }).click();

    await expect(ledger).toContainText('Lịch sử nhập – xuất kho');
    await expect(ledger).toContainText('10 kg');
    if (testInfo.project.name === 'mobile-chromium') {
      await expect(ledger.locator('table')).toHaveCSS('display', 'block');
      await ledger.getByRole('button', { name: 'Dạng bảng' }).click();
      await expect(ledger.locator('table')).toHaveCSS('display', 'table');
    }
  });

  test('Production chỉ hiện một cảnh báo chung và không lặp nội dung DEMO', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Chỉ kiểm tra một lần trên desktop');
    await page.getByTestId('env-btn-production').click();
    await page.getByTestId('quick-btn-attendance').click();
    await expect(page.getByTestId('attendance-modal')).toHaveCount(0);
    await expect(page.getByText(/Production: hồ sơ nhân sự/)).toBeVisible();
    await openSidebarPage(page, 'inventory');

    await expect(page.getByText(/Production: hồ sơ nhân sự/)).toHaveCount(1);
    await expect(page.getByTestId('page-inventory')).toHaveCount(0);
    await expect(page.getByTestId('stock-prod-not-ready')).toHaveCount(0);
    await expect(page.getByText(/Phase 4D – Thẻ kho Production/)).toHaveCount(0);
  });

  test('các phân hệ tải tệp ExcelJS định dạng XLSX', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Chỉ chạy một lần trên desktop');
    test.setTimeout(120_000);

    await openSidebarPage(page, 'cashbook');
    let downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-cashbook-excel-btn').click();
    let download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^SoThuChi_DuNhua_.+\.xlsx$/);

    await openSidebarPage(page, 'attendance');
    downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-timesheet-excel-btn').click();
    download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^BangChamCong_DuNhuaPheLieu_.+\.xlsx$/);

    await openSidebarPage(page, 'inventory');
    downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-stock-excel-btn').click();
    download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('TheKho_DEMO_DuNhua.xlsx');

    await page.evaluate(() => {
      localStorage.setItem('dunhua_demo_payroll_periods_v2', JSON.stringify([{
        id: '2026-11', month: '2026-11', status: 'draft', createdAt: '2026-11-01', updatedAt: '2026-11-01', lastAction: 'E2E',
        lines: [{ employeeCode: 'CN-001', employeeName: 'Nhân viên E2E', basis: 'Ngày', paidDays: 1, regularHours: 8, overtimeHours: 0, rate: 300000, productionKg: 0, basePay: 300000, overtimePay: 0, allowance: 0, bonus: 0, advance: 0, deductions: 0, netPay: 300000 }],
        payments: [],
      }]));
    });
    await openSidebarPage(page, 'hr');
    downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-payroll-excel-btn').click();
    download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('BangLuong_DEMO_2026-11.xlsx');
  });
});
