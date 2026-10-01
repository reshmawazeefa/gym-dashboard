import { createElement } from "react";
import { X } from "lucide-react";

export default function BookingModalShell({
  title,
  description,
  icon: Icon,
  isOpen,
  onClose,
  children,
  footer,
  sizeClass = "max-w-2xl",
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`flex max-h-[90vh] w-full ${sizeClass} flex-col overflow-hidden rounded-[18px] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.18)]`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-[#E2E8F0] px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#CFEFDB] bg-[#EAFBF3] text-[#0D8252]">
              {createElement(Icon, { size: 18 })}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
              {description && <p className="mt-0.5 text-xs text-[#64748B]">{description}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${title} modal`} className="rounded-lg p-2 text-[#64748B] transition hover:bg-[#F1F5F9] hover:text-[#0F172A]">
            <X size={17} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] bg-white px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}
