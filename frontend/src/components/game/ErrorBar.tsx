/**
 * Dismissible top-of-page error strip. Used for XDR submission errors,
 * wallet issues, socket failures — anything that needs to be visible but
 * not block the whole page.
 */
export function ErrorBar({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-6 px-4 py-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center justify-between">
      <span>{message}</span>
      <button
        onClick={onClose}
        className="text-danger/80 hover:text-danger"
        aria-label="Dismiss error"
      >
        ✕
      </button>
    </div>
  );
}
