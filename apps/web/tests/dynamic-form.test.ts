import { describe, expect, it } from 'vitest';
import type { ServiceFieldDto } from '@/lib/api/catalog';
import { isFieldVisible, validateDynamicForm } from '@/components/common/DynamicForm';

/**
 * Unit tests for the DynamicForm renderer logic (7.6.9 / 3.3.7 / 3.3.8).
 * Validation mirrors the server-side DynamicFormValidator — the server
 * remains the source of truth; these tests protect the UX layer.
 */

function field(overrides: Partial<ServiceFieldDto>): ServiceFieldDto {
  return {
    id: '1',
    uuid: 'u1',
    label: 'فیلد',
    name: 'field',
    type: 'text',
    required: false,
    sortOrder: 1,
    active: true,
    ...overrides,
  };
}

describe('validateDynamicForm', () => {
  it('flags missing required fields', () => {
    const fields = [field({ name: 'a', label: 'کد', required: true })];
    const errors = validateDynamicForm(fields, {});
    expect(errors.a).toContain('الزامی');
  });

  it('accepts filled required fields and ignores empty optional ones', () => {
    const fields = [
      field({ name: 'a', required: true }),
      field({ name: 'b', required: false, type: 'number' }),
    ];
    const errors = validateDynamicForm(fields, { a: 'hello', b: '' });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('validates number type', () => {
    const fields = [field({ name: 'n', type: 'number' })];
    expect(validateDynamicForm(fields, { n: 'abc' }).n).toBeTruthy();
    expect(validateDynamicForm(fields, { n: 42 }).n).toBeUndefined();
  });

  it('validates email format', () => {
    const fields = [field({ name: 'e', type: 'email' })];
    expect(validateDynamicForm(fields, { e: 'not-an-email' }).e).toBeTruthy();
    expect(validateDynamicForm(fields, { e: 'a@b.co' }).e).toBeUndefined();
  });

  it('validates Iranian phone format', () => {
    const fields = [field({ name: 'p', type: 'phone' })];
    expect(validateDynamicForm(fields, { p: '12345' }).p).toBeTruthy();
    expect(validateDynamicForm(fields, { p: '09123456789' }).p).toBeUndefined();
    expect(validateDynamicForm(fields, { p: '+989123456789' }).p).toBeUndefined();
  });

  it('applies min/max rules for strings and numbers', () => {
    const fields = [
      field({ name: 's', validationRules: [{ type: 'min', params: { value: 3 } }] }),
      field({
        name: 'n',
        type: 'number',
        validationRules: [{ type: 'max', params: { value: 10 } }],
      }),
    ];
    expect(validateDynamicForm(fields, { s: 'ab' }).s).toBeTruthy();
    expect(validateDynamicForm(fields, { s: 'abc' }).s).toBeUndefined();
    expect(validateDynamicForm(fields, { n: 11 }).n).toBeTruthy();
    expect(validateDynamicForm(fields, { n: 10 }).n).toBeUndefined();
  });

  it('applies pattern rules', () => {
    const fields = [
      field({
        name: 'code',
        validationRules: [{ type: 'pattern', params: { regex: '^RR\\d+$' } }],
      }),
    ];
    expect(validateDynamicForm(fields, { code: 'RR123' }).code).toBeUndefined();
    expect(validateDynamicForm(fields, { code: 'XX123' }).code).toBeTruthy();
  });

  it('skips inactive fields', () => {
    const fields = [field({ name: 'a', required: true, active: false })];
    expect(Object.keys(validateDynamicForm(fields, {}))).toHaveLength(0);
  });
});

describe('isFieldVisible (conditional visibility — 3.3.8)', () => {
  const select = field({
    name: 'delivery',
    type: 'select',
    options: [
      { value: 'pickup', label: 'حضوری' },
      { value: 'post', label: 'پست' },
    ],
  });

  const dependent = field({
    name: 'tracking_code',
    validationRules: [{ type: 'visible_if', params: { field: 'delivery', values: ['post'] } }],
  });

  it('hides dependent field when condition not met', () => {
    expect(isFieldVisible(dependent, { delivery: 'pickup' })).toBe(false);
  });

  it('shows dependent field when condition met', () => {
    expect(isFieldVisible(dependent, { delivery: 'post' })).toBe(true);
  });

  it('shows fields without visible_if rules always', () => {
    expect(isFieldVisible(select, {})).toBe(true);
  });

  it('validateDynamicForm excludes hidden fields from validation', () => {
    void [select, dependent];
    // Hidden + required tracking_code must NOT error while invisible
    const hidden = field({
      name: 'tracking_code',
      required: true,
      validationRules: [{ type: 'visible_if', params: { field: 'delivery', values: ['post'] } }],
    });
    const errors = validateDynamicForm([select, hidden], { delivery: 'pickup' });
    expect(errors.tracking_code).toBeUndefined();
  });
});
