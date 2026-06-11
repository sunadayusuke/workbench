"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CodeField } from "@/components/ui/code-field";
import { FlatButton } from "@/components/ui/flat-button";
import { useClipboard } from "@/hooks/use-clipboard";
import { useLanguage } from "@/lib/i18n";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  code: string;
  filename?: string;
  onDownloadHtml?: () => void | Promise<void>;
  children?: React.ReactNode;
}

/**
 * Code export dialog (zinc). Buttons: close (outline) / .html (outline,
 * raw label) / copy (solid). Default `.html` download = inline blob `<a>`
 * click when `filename` given; `onDownloadHtml` overrides.
 */
export function ExportDialog({
  open,
  onOpenChange,
  title,
  code,
  filename,
  onDownloadHtml,
  children,
}: ExportDialogProps) {
  const { t } = useLanguage();
  const { copy, copied } = useClipboard();

  const handleDownload = () => {
    if (onDownloadHtml) {
      onDownloadHtml();
      return;
    }
    if (!filename) return;
    const b = new Blob([code], { type: "text/html" });
    const u = URL.createObjectURL(b);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(u);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]! max-h-[80vh] flex! flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
        <CodeField readOnly value={code} className="flex-1 min-h-[300px]" />
        <div className="flex justify-end gap-2 pt-2">
          <FlatButton variant="outline" onClick={() => onOpenChange(false)}>
            {t.close}
          </FlatButton>
          {(filename || onDownloadHtml) && (
            <FlatButton variant="outline" onClick={handleDownload}>
              .html
            </FlatButton>
          )}
          <FlatButton onClick={() => copy(code)}>
            {copied ? t.copied : t.copy}
          </FlatButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
