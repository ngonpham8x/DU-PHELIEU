import { useEffect } from 'react';

const MOBILE_CARD_ATTRIBUTE = 'data-mobile-card';

function enhanceTable(table: HTMLTableElement) {
  table.setAttribute(MOBILE_CARD_ATTRIBUTE, 'true');
  table.classList.add('responsive-data-table');

  const headerCells = Array.from(
    table.querySelectorAll<HTMLTableCellElement>('thead tr:last-child th'),
  );
  const labels = headerCells.map((cell) => cell.textContent?.trim() || 'Thông tin');

  table.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((row) => {
    Array.from(row.cells).forEach((cell, index) => {
      if (!cell.hasAttribute('data-label')) {
        cell.setAttribute('data-label', labels[index] || `Thông tin ${index + 1}`);
      }
    });
  });

  const shell = table.parentElement;
  if (shell) shell.classList.add('responsive-table-scroll');
}

function enhanceTables(root: ParentNode) {
  root.querySelectorAll<HTMLTableElement>('table').forEach(enhanceTable);
}

/**
 * Bổ sung cuộn ngang và nhãn cho dạng thẻ mobile cho cả bảng legacy lẫn
 * các module tải động. MutationObserver giúp bảng mới xuất hiện sau lazy load
 * hoặc đổi màn hình vẫn nhận cùng một hành vi responsive.
 */
export function ResponsiveTableEnhancer() {
  useEffect(() => {
    enhanceTables(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node instanceof HTMLTableElement) enhanceTable(node);
          enhanceTables(node);
        }
      }
    });

    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
