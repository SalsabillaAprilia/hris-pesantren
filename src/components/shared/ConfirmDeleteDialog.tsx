import React, { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: React.ReactNode;
  onConfirm: () => void;
  isLoading?: boolean;
  confirmText?: string;
  cancelText?: string;
  requireConfirmationText?: boolean;
  confirmationTextValue?: string;
  itemName?: string;
  disableConfirm?: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Konfirmasi Penghapusan",
  description,
  onConfirm,
  isLoading = false,
  confirmText = "Hapus",
  cancelText = "Batal",
  requireConfirmationText = false,
  confirmationTextValue = "HAPUS",
  itemName,
  disableConfirm = false,
}: ConfirmDeleteDialogProps) {
  const [userInput, setUserInput] = useState("");

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setUserInput("");
    }
  }, [open]);

  const isConfirmDisabled = isLoading || disableConfirm || (requireConfirmationText && userInput !== confirmationTextValue);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="shadow-2xl border-none">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl font-bold">{title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2 text-slate-600">
              {description || (
                <p>
                  Apakah Anda yakin ingin menghapus{" "}
                  {itemName ? (
                    <>
                      data <strong>{itemName}</strong>
                    </>
                  ) : (
                    "data ini"
                  )}
                  ? Tindakan ini tidak dapat dibatalkan.
                </p>
              )}

              {requireConfirmationText && (
                <div className="space-y-2 p-4 bg-destructive/5 rounded-lg border border-destructive/10">
                  <p className="text-xs text-muted-foreground">
                    Ketik <strong>{confirmationTextValue}</strong> di bawah ini untuk melanjutkan:
                  </p>
                  <Input
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder={confirmationTextValue}
                    className="h-9 text-sm border-destructive/20 focus-visible:ring-destructive bg-white"
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 pt-4">
          <AlertDialogCancel className="h-10 min-w-[120px] text-sm font-semibold">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isConfirmDisabled}
            className="h-10 min-w-[120px] text-sm bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold shadow-lg shadow-destructive/20 transition-all"
          >
            {isLoading ? "Memproses..." : confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
