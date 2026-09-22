declare module 'html2pdf.js' {
  type Html2PdfOptions = Record<string, unknown>;

  interface Html2PdfWorker {
    set(options: Html2PdfOptions): Html2PdfWorker;
    from(source: HTMLElement): Html2PdfWorker;
    save(): Promise<void>;
  }

  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}
