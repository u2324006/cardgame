import React, { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ページ内に表示する確認ダイアログ（ブラウザの confirm() が使えない環境でも動くように）
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ message, confirmLabel, onConfirm, onCancel }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={message} onClick={e => e.stopPropagation()}>
        <p className="dialog-message">{message}</p>
        <div className="dialog-actions">
          <button type="button" ref={cancelRef} className="secondary-button" onClick={onCancel}>キャンセル</button>
          <button type="button" className="primary-button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
