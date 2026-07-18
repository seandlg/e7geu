import type { PaperSize } from './model';

export function printCv(paper: PaperSize): void {
  const style = document.createElement('style');
  style.dataset.cvPrintPage = '';
  style.textContent = `@page { size: ${paper === 'a4' ? 'A4' : 'letter'}; margin: 0; }`;
  document.head.append(style);
  document.documentElement.dataset.printingCv = 'true';

  const cleanup = (): void => {
    delete document.documentElement.dataset.printingCv;
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  window.print();
}
