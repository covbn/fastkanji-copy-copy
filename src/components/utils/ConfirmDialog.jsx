import React from "react";
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

let resolveCallback = null;

export const confirmDialog = {
  show: ({ title, description, confirmText = "Continue", cancelText = "Cancel", destructive = false }) => {
    return new Promise((resolve) => {
      resolveCallback = resolve;
      const event = new CustomEvent('confirmDialog', {
        detail: { title, description, confirmText, cancelText, destructive }
      });
      window.dispatchEvent(event);
    });
  },
  close: (result) => {
    if (resolveCallback) {
      resolveCallback(result);
      resolveCallback = null;
    }
  }
};

export function ConfirmDialogProvider({ children }) {
  const [open, setOpen] = React.useState(false);
  const [config, setConfig] = React.useState({});

  React.useEffect(() => {
    const handler = (e) => {
      setConfig(e.detail);
      setOpen(true);
    };
    window.addEventListener('confirmDialog', handler);
    return () => window.removeEventListener('confirmDialog', handler);
  }, []);

  const handleConfirm = () => {
    confirmDialog.close(true);
    setOpen(false);
  };

  const handleCancel = () => {
    confirmDialog.close(false);
    setOpen(false);
  };

  return (
    <>
      {children}
      <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{config.title}</AlertDialogTitle>
            <AlertDialogDescription>{config.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {config.cancelText || "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={config.destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {config.confirmText || "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}