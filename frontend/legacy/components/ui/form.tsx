import { useState, type ReactNode } from 'react';
import { DatePicker, Select as AntSelect, type SelectProps } from 'antd';
import dayjs from 'dayjs';
import { label } from '../../types';

export interface Option {
  value: string | number;
  label: ReactNode;
  disabled?: boolean;
}

/** A labelled group of options in the dropdown. */
export interface OptionGroup {
  label: string;
  options: Option[];
}

const toAnt = (o: Option) => ({
  value: String(o.value),
  label: o.label,
  title: typeof o.label === 'string' ? o.label : String(o.value),
  disabled: o.disabled,
});

/**
 * Carries a custom control's value into the surrounding form's FormData. When
 * required, it is a visually hidden field so native validation still applies.
 */
function FormValue({
  name,
  value,
  required,
}: {
  name?: string;
  value: string;
  required?: boolean;
}) {
  if (required)
    return (
      <input
        className="required-proxy"
        name={name}
        value={value}
        required
        tabIndex={-1}
        aria-hidden
        onChange={() => {}}
      />
    );
  return name ? <input type="hidden" name={name} value={value} /> : null;
}

/**
 * antd Select that behaves like a native one: string values, an option may
 * have the value '', and with `name` the value is part of the form's FormData.
 */
export function Select({
  name,
  value,
  defaultValue,
  onChange,
  options,
  required,
  ...props
}: Omit<SelectProps, 'value' | 'defaultValue' | 'onChange' | 'options'> & {
  name?: string;
  value?: string | number | null;
  defaultValue?: string | number | null;
  onChange?: (value: string) => void;
  options: (Option | OptionGroup)[];
  required?: boolean;
}) {
  const [own, setOwn] = useState(String(defaultValue ?? ''));
  const current = String(value === undefined ? own : (value ?? ''));
  const flat = options.flatMap((o) => ('options' in o ? o.options : [o]));
  const hasEmpty = flat.some((o) => o.value === '');
  return (
    <>
      <AntSelect
        {...props}
        value={current === '' && !hasEmpty ? undefined : current}
        showSearch={flat.length > 8 ? { optionFilterProp: 'title' } : undefined}
        onChange={(v?: string) => {
          setOwn(v ?? '');
          onChange?.(v ?? '');
        }}
        options={options.map((o) =>
          'options' in o
            ? { label: o.label, title: o.label, options: o.options.map(toAnt) }
            : toAnt(o),
        )}
      />
      <FormValue name={name} value={current} required={required} />
    </>
  );
}

/** antd DatePicker exchanging `YYYY-MM-DD` strings, like `<input type="date">`. */
export function DateInput({
  name,
  value,
  defaultValue,
  onChange,
  required,
  ...props
}: {
  name?: string;
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? '');
  const current = value === undefined ? own : (value ?? '');
  return (
    <>
      <DatePicker
        {...props}
        style={{ width: '100%' }}
        value={current ? dayjs(current) : null}
        onChange={(d) => {
          const v = d ? d.format('YYYY-MM-DD') : '';
          setOwn(v);
          onChange?.(v);
        }}
      />
      <FormValue name={name} value={current} required={required} />
    </>
  );
}

/** Options for a list of enum values, shown with their readable labels. */
export const labelled = (values: readonly string[]): Option[] =>
  values.map((value) => ({ value, label: label(value) }));
