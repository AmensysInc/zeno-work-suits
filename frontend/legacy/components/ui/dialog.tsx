import { Modal as AntModal } from 'antd';
import type { ReactNode } from 'react';
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <AntModal
      open={open}
      onCancel={onClose}
      title={title}
      footer={null}
      width={wide ? 960 : 650}
      destroyOnHidden
      centered
    >
      {children}
    </AntModal>
  );
}
