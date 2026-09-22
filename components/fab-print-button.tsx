export function FabPrintButton() {
  return (
    <button
      type="button"
      className="fab-print"
      aria-label="Imprimir página"
      title="Imprimir página"
      onClick={() => window.print()}
    >
      🖨
    </button>
  );
}
