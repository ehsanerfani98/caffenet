'use client';

import { useMemo } from 'react';
import type { ServiceFieldDto } from '@/lib/api/catalog';
import { cn } from '@/lib/utils';

/**
 * DynamicForm renderer (7.6.9 — closes deferred 3.3.7 + 3.3.8).
 *
 * Renders any service's field set and validates client-side for UX.
 * The server (DynamicFormValidator) ALWAYS re-validates on submit.
 *
 * Conditional visibility (3.3.8): a field is shown only when every rule of
 * type `visible_if` matches. Rule params: { field: string, values: string[] }.
 * Hidden fields are excluded from submitted values.
 */

export interface DynamicFormErrors {
  [fieldName: string]: string;
}

interface DynamicFormProps {
  fields: ServiceFieldDto[];
  values: Record<string, unknown>;
  errors?: DynamicFormErrors;
  onChange: (name: string, value: unknown) => void;
  /** Render a file field (used for file/image types) */
  renderFileField?: (field: ServiceFieldDto, value: unknown, error?: string) => React.ReactNode;
  className?: string;
}

/** Evaluate conditional visibility rules for a field (3.3.8). */
export function isFieldVisible(field: ServiceFieldDto, values: Record<string, unknown>): boolean {
  const rules = (field.validationRules ?? []).filter((r) => r.type === 'visible_if');
  for (const rule of rules) {
    const target = rule.params?.field as string | undefined;
    const expected = (rule.params?.values as string[] | undefined) ?? [];
    if (!target) continue;
    const actual = values[target];
    const actualStr = Array.isArray(actual) ? actual.map(String) : [String(actual ?? '')];
    const match = expected.some((v) => actualStr.includes(v));
    if (!match) return false;
  }
  return true;
}

export function validateDynamicForm(
  fields: ServiceFieldDto[],
  values: Record<string, unknown>,
): DynamicFormErrors {
  const errors: DynamicFormErrors = {};

  for (const field of fields) {
    if (!field.active || !isFieldVisible(field, values)) continue;

    const raw = values[field.name];
    const isEmpty =
      raw === undefined || raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0);

    if (field.required && isEmpty) {
      errors[field.name] = `پر کردن «${field.label}» الزامی است`;
      continue;
    }
    if (isEmpty) continue;

    // Type checks (mirror server-side validators)
    switch (field.type) {
      case 'number': {
        const n = Number(raw);
        if (Number.isNaN(n)) errors[field.name] = 'مقدار باید عدد باشد';
        break;
      }
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw)))
          errors[field.name] = 'فرمت ایمیل نامعتبر است';
        break;
      case 'phone': {
        const norm = String(raw).replace(/[\s-]/g, '');
        if (!/^(\+?98|0)?9\d{9}$/.test(norm))
          errors[field.name] = 'شماره موبایل ایرانی نامعتبر است (09xxxxxxxxx)';
        break;
      }
      default:
        break;
    }

    if (errors[field.name]) continue;

    // Validation rules (mirror server-side applyRule)
    for (const rule of field.validationRules ?? []) {
      if (rule.type === 'visible_if') continue;
      const err = applyRuleClient(rule, raw);
      if (err) {
        errors[field.name] = err;
        break;
      }
    }
  }

  return errors;
}

function applyRuleClient(
  rule: { type: string; params?: Record<string, unknown>; message?: string },
  value: unknown,
): string | null {
  switch (rule.type) {
    case 'min': {
      if (typeof value === 'string') {
        const min = Number(rule.params?.value ?? rule.params?.length ?? 0);
        if (value.length < min) return rule.message ?? `حداقل ${min} کاراکتر`;
      } else if (typeof value === 'number') {
        const min = Number(rule.params?.value ?? 0);
        if (value < min) return rule.message ?? `حداقل مقدار: ${min}`;
      }
      return null;
    }
    case 'max': {
      if (typeof value === 'string') {
        const max = Number(rule.params?.value ?? rule.params?.length ?? 1000);
        if (value.length > max) return rule.message ?? `حداکثر ${max} کاراکتر`;
      } else if (typeof value === 'number') {
        const max = Number(rule.params?.value ?? 0);
        if (value > max) return rule.message ?? `حداکثر مقدار: ${max}`;
      }
      return null;
    }
    case 'pattern': {
      const regexStr = rule.params?.regex as string | undefined;
      if (!regexStr) return null;
      try {
        if (typeof value === 'string' && !new RegExp(regexStr).test(value))
          return rule.message ?? 'فرمت نامعتبر است';
      } catch {
        return null;
      }
      return null;
    }
    case 'enum': {
      const allowed = (rule.params?.values as string[] | undefined) ?? [];
      if (allowed.length && !allowed.includes(String(value)))
        return rule.message ?? 'مقدار مجاز نیست';
      return null;
    }
    default:
      return null;
  }
}

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 transition-shadow';

export function DynamicForm({
  fields,
  values,
  errors = {},
  onChange,
  renderFileField,
  className,
}: DynamicFormProps) {
  const visibleFields = useMemo(
    () => fields.filter((f) => f.active && isFieldVisible(f, values)),
    [fields, values],
  );

  return (
    <div className={cn('space-y-4', className)}>
      {visibleFields.map((field) => {
        const error = errors[field.name];
        const value = values[field.name];

        return (
          <div key={field.id}>
            <label className="mb-1.5 block text-sm font-medium text-gray-800">
              {field.label}
              {field.required && <span className="mr-1 text-red-500">*</span>}
            </label>

            {field.type === 'textarea' && (
              <textarea
                className={cn(inputClass, 'min-h-[96px] resize-y', error && 'border-red-300')}
                placeholder={field.placeholder ?? ''}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            )}

            {field.type === 'select' && (
              <select
                className={cn(inputClass, error && 'border-red-300')}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
              >
                <option value="">انتخاب کنید…</option>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === 'multiselect' && (
              <div className="flex flex-wrap gap-2">
                {(field.options ?? []).map((o) => {
                  const arr = Array.isArray(value) ? value.map(String) : [];
                  const checked = arr.includes(o.value);
                  return (
                    <button
                      type="button"
                      key={o.value}
                      className={cn(
                        'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors',
                        checked
                          ? 'border-brand-600 bg-brand-50 text-brand-700'
                          : 'border-gray-200 bg-white text-gray-600',
                      )}
                      onClick={() =>
                        onChange(
                          field.name,
                          checked ? arr.filter((v) => v !== o.value) : [...arr, o.value],
                        )
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            )}

            {field.type === 'radio' && (
              <div className="space-y-2">
                {(field.options ?? []).map((o) => (
                  <label
                    key={o.value}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors',
                      String(value) === o.value
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-gray-200 bg-white text-gray-700',
                    )}
                  >
                    <input
                      type="radio"
                      name={field.name}
                      value={o.value}
                      checked={String(value) === o.value}
                      onChange={() => onChange(field.name, o.value)}
                      className="accent-brand-600 h-4 w-4"
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            )}

            {field.type === 'checkbox' && (
              <div className="space-y-2">
                {(field.options ?? []).map((o) => {
                  const arr = Array.isArray(value) ? value.map(String) : [];
                  const checked = arr.includes(o.value);
                  return (
                    <label
                      key={o.value}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border p-3 text-sm transition-colors',
                        checked
                          ? 'border-brand-600 bg-brand-50 text-brand-800'
                          : 'border-gray-200 bg-white text-gray-700',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          onChange(
                            field.name,
                            checked ? arr.filter((v) => v !== o.value) : [...arr, o.value],
                          )
                        }
                        className="accent-brand-600 h-4 w-4"
                      />
                      {o.label}
                    </label>
                  );
                })}
              </div>
            )}

            {(field.type === 'text' ||
              field.type === 'number' ||
              field.type === 'email' ||
              field.type === 'phone' ||
              field.type === 'date' ||
              field.type === 'time') && (
              <input
                type={field.type === 'phone' ? 'tel' : field.type}
                inputMode={
                  field.type === 'number' ? 'decimal' : field.type === 'phone' ? 'tel' : undefined
                }
                className={cn(inputClass, error && 'border-red-300')}
                placeholder={field.placeholder ?? ''}
                value={String(value ?? '')}
                onChange={(e) =>
                  onChange(
                    field.name,
                    field.type === 'number'
                      ? e.target.value === ''
                        ? ''
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
              />
            )}

            {field.type === 'datetime' && (
              <input
                type="datetime-local"
                className={cn(inputClass, error && 'border-red-300')}
                value={String(value ?? '')}
                onChange={(e) => onChange(field.name, e.target.value)}
              />
            )}

            {(field.type === 'file' || field.type === 'image') &&
              (renderFileField ? (
                renderFileField(field, value, error)
              ) : (
                <input
                  className={cn(inputClass, error && 'border-red-300')}
                  placeholder="شناسه فایل آپلودشده"
                  value={String(value ?? '')}
                  onChange={(e) => onChange(field.name, e.target.value)}
                />
              ))}

            {field.helpText && !error && (
              <p className="mt-1 text-xs text-gray-400">{field.helpText}</p>
            )}
            {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
          </div>
        );
      })}
    </div>
  );
}
