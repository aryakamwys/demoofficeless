// Modal konfirmasi untuk aksi penting (setuju klaim, keputusan manager).
// Struktur modal daisyUI (tema dimatikan) + warna eksplisit — konsisten
// dengan gaya portal/approver: putih, satu tombol hijau solid.
// Tanpa "use client": selalu dirender dari halaman client (pemakai event).
export function ConfirmModal({
  open,
  title,
  desc,
  confirmLabel,
  busy,
  danger,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  desc: string;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{desc}</p>
        <div className="modal-action mt-4">
          <button
            type="button"
            className="btn btn-sm h-10 min-h-0 rounded-xl border-slate-300 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            disabled={busy}
          >
            Batal
          </button>
          <button
            type="button"
            className={`btn btn-sm h-10 min-h-0 rounded-xl border-0 px-4 text-[13px] font-semibold text-white ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-[#00B14F] hover:bg-[#009040]"
            }`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <span className="loading loading-spinner loading-xs" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Tutup" onClick={onCancel} />
    </div>
  );
}

/** Modal info setelah aksi tersimpan — memastikan pengguna tahu notifikasi
 *  WhatsApp memang berjalan (dikirim di background, tidak perlu menunggu). */
export function InfoModal({
  open,
  title,
  desc,
  onClose,
}: {
  open: boolean;
  title: string;
  desc: string;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="modal modal-open" role="dialog" aria-modal="true">
      <div className="modal-box max-w-sm rounded-2xl bg-white p-5">
        <h3 className="text-[15px] font-bold text-slate-900">{title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{desc}</p>
        <div className="modal-action mt-4">
          <button
            type="button"
            className="btn btn-sm h-10 min-h-0 rounded-xl border-0 bg-[#00B14F] px-4 text-[13px] font-semibold text-white hover:bg-[#009040]"
            onClick={onClose}
          >
            Oke
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label="Tutup" onClick={onClose} />
    </div>
  );
}
