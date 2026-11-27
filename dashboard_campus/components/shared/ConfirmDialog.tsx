"use client";

import { useId } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import FormAlert from "@/components/shared/FormAlert";

// Confirmation for destructive actions (delete), instead of the browser's window.confirm.
export default function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Delete",
  busy = false,
  error,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Modal isOpen={isOpen} onClose={busy ? () => undefined : onClose} size="sm" labelledBy={titleId}>
      <ModalHeader>
        <ModalTitle id={titleId}>{title}</ModalTitle>
        <ModalDescription className="pt-1 text-sm">{description}</ModalDescription>
      </ModalHeader>
      <FormAlert message={error} />
      <ModalFooter className="pt-4">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} isLoading={busy}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
