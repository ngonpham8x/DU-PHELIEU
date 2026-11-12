import { expect, test, type Page } from '@playwright/test';

async function openSidebarPage(page: Page, id: string) {
  const mobileMenu = page.getByTestId('mobile-hamburger-btn');
  if (await mobileMenu.isVisible()) await mobileMenu.click();
  await page.getByTestId(`sidebar-item-${id}`).click();
}

test.describe('Phase 4F – kiểm tra giao diện DEMO', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('page-home')).toBeVisible();
  });

  test('Cài đặt có xem trước chuyển dữ liệu và không còn khung chính sách', async ({ page }) => {
    await openSidebarPage(page, 'settings');
    await expect(page.getByTestId('page-settings')).toBeVisible();
    await expect(page.getByTestId('security-account-policy')).toHaveCount(0);
    await expect(page.getByText('Chính sách tài khoản quản trị và chống xâm nhập')).toHaveCount(0);

    const migrationPreview = page.getByTestId('production-migration-preview');
    await expect(migrationPreview).toBeVisible();
    await page.getByTestId('migration-workshop-id').fill('mã xưởng có dấu');
    await expect(migrationPreview.getByText(/Mã xưởng phải dài/)).toBeVisible();
    await page.getByTestId('migration-workshop-id').fill('du_nhua_01');

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('download-migration-preview').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('XemTruoc_ChuyenNhanSu_DuNhua.json');
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
