import * as Dialog from "@radix-ui/react-dialog";
import { useState, type ReactNode } from "react";
/** Portal above Watch Party; Radix contains focus, inerts background and restores focus. */
export function Modal({
  title,
  onClose,
  children,
  className = "",
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const [returnFocus] = useState(() =>
    typeof document === "undefined" ? null : (document.activeElement as HTMLElement | null),
  );
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-deep/85 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          data-testid={testId}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (returnFocus?.isConnected) returnFocus.focus();
          }}
          className={`fixed inset-0 z-[61] flex items-end justify-center overflow-y-auto p-3 outline-none sm:items-center ${className}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
