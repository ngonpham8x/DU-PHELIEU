import { useEffect } from 'react';

const MOBILE_CARD_ATTRIBUTE = 'data-mobile-card';
const SCROLL_SHELL_ATTRIBUTE = 'data-responsive-table-shell';

type EnhancedTable = {
  table: HTMLTableElement;
  shell: HTMLElement;
  topScrollbar: HTMLDivElement;
  topSpacer: HTMLDivElement;
  resizeObserver: ResizeObserver;
  update: () => void;
  cleanup: () => void;
};

function labelTableCells(table: HTMLTableElement) {
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
}

function createEnhancement(table: HTMLTableElement): EnhancedTable | null {
  const shell = table.parentElement;
  if (!shell || shell.hasAttribute(SCROLL_SHELL_ATTRIBUTE)) return null;

  table.setAttribute(MOBILE_CARD_ATTRIBUTE, 'true');
  table.classList.add('responsive-data-table');
  labelTableCells(table);

  shell.classList.add('responsive-table-scroll');
  shell.setAttribute(SCROLL_SHELL_ATTRIBUTE, 'true');

  const topScrollbar = document.createElement('div');
  topScrollbar.className = 'responsive-table-scroll-top';
  topScrollbar.tabIndex = 0;
  topScrollbar.setAttribute('aria-label', 'Thanh cuộn ngang phía trên bảng');
  topScrollbar.setAttribute('title', 'Kéo sang trái hoặc phải để xem toàn bộ bảng');

  const topSpacer = document.createElement('div');
  topSpacer.className = 'responsive-table-scroll-top-spacer';
  topScrollbar.appendChild(topSpacer);
  shell.before(topScrollbar);

  let syncing = false;

  const syncFromTop = () => {
    if (syncing) return;
    syncing = true;
    shell.scrollLeft = topScrollbar.scrollLeft;
    syncing = false;
  };

  const syncFromBottom = () => {
    if (syncing) return;
    syncing = true;
    topScrollbar.scrollLeft = shell.scrollLeft;
    syncing = false;
  };

  const update = () => {
    labelTableCells(table);

    const viewportWidth = shell.clientWidth;
    const contentWidth = Math.max(table.scrollWidth, shell.scrollWidth);
    const hasOverflow = viewportWidth > 0 && contentWidth > viewportWidth + 1;

    topScrollbar.style.width = `${viewportWidth}px`;
    topSpacer.style.width = `${contentWidth}px`;
    topScrollbar.hidden = !hasOverflow;

    if (hasOverflow) syncFromBottom();
  };

  topScrollbar.addEventListener('scroll', syncFromTop, { passive: true });
  shell.addEventListener('scroll', syncFromBottom, { passive: true });

  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(table);
  resizeObserver.observe(shell);

  const cleanup = () => {
    resizeObserver.disconnect();
    topScrollbar.removeEventListener('scroll', syncFromTop);
    shell.removeEventListener('scroll', syncFromBottom);
    topScrollbar.remove();
    shell.classList.remove('responsive-table-scroll');
    shell.removeAttribute(SCROLL_SHELL_ATTRIBUTE);
  };

  requestAnimationFrame(update);

  return { table, shell, topScrollbar, topSpacer, resizeObserver, update, cleanup };
}

function enhanceTables(root: ParentNode, enhancements: Map<HTMLElement, EnhancedTable>) {
  root.querySelectorAll<HTMLTableElement>('table').forEach((table) => {
    if (table.closest('.responsive-table-scroll-top')) return;
    if (table.hasAttribute(MOBILE_CARD_ATTRIBUTE)) {
      labelTableCells(table);
      return;
    }

    const enhancement = createEnhancement(table);
    if (enhancement) enhancements.set(enhancement.shell, enhancement);
  });
}

/**
 * Bổ sung thanh cuộn ngang kép và nhãn cho dạng thẻ mobile cho cả bảng
 * legacy lẫn các module tải động. Thanh phía trên và phía dưới luôn đồng bộ.
 */
export function ResponsiveTableEnhancer() {
  useEffect(() => {
    const enhancements = new Map<HTMLElement, EnhancedTable>();
    enhanceTables(document, enhancements);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node instanceof HTMLTableElement) {
            const enhancement = createEnhancement(node);
            if (enhancement) enhancements.set(enhancement.shell, enhancement);
          }
          enhanceTables(node, enhancements);
        }
      }

      for (const [shell, enhancement] of enhancements) {
        if (!shell.isConnected || !enhancement.table.isConnected) {
          enhancement.cleanup();
          enhancements.delete(shell);
        } else {
          enhancement.update();
        }
      }
    });

    observer.observe(document.getElementById('root') || document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      enhancements.forEach((enhancement) => enhancement.cleanup());
      enhancements.clear();
    };
  }, []);

  return null;
}
