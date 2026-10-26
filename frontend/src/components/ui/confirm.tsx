import { App, Input } from 'antd';
import type { HookAPI } from 'antd/es/modal/useModal';

let modal: HookAPI | undefined;

/** Mounted once inside antd's <App> so confirm() dialogs use the app theme. */
export function ConfirmHost() {
  modal = App.useApp().modal;
  return null;
}

/** Themed replacement for window.prompt. Resolves null when cancelled. */
export function prompt(title: string, initial = ''): Promise<string | null> {
  if (!modal) return Promise.resolve(window.prompt(title, initial));
  let value = initial;
  return new Promise((resolve) =>
    modal!.confirm({
      title,
      icon: null,
      content: (
        <Input
          autoFocus
          defaultValue={initial}
          onChange={(e) => (value = e.target.value)}
        />
      ),
      onOk: () => resolve(value),
      onCancel: () => resolve(null),
    }),
  );
}

/** Themed replacement for window.confirm. Resolves true when confirmed. */
export function confirm(
  content: string,
  { danger = true, okText = 'Confirm' } = {},
): Promise<boolean> {
  if (!modal) return Promise.resolve(window.confirm(content));
  return new Promise((resolve) =>
    modal!.confirm({
      title: 'Are you sure?',
      content,
      okText,
      okButtonProps: { danger },
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    }),
  );
}
