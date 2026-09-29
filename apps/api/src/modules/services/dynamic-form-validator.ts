import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ServiceFieldType } from '@caffenet/shared';

export interface FieldDefinition {
  name: string;
  label: string;
  type: ServiceFieldType;
  required: boolean;
  validationRules?: Array<{
    type: string;
    params?: Record<string, unknown>;
    message?: string;
  }>;
  options?: Array<{ value: string; label: string }>;
}

export interface ValidationContext {
  /** Map of field name → submitted value */
  values: Record<string, unknown>;
  fields: FieldDefinition[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: FieldError[];
  /** Sanitized values (e.g. number strings converted to numbers) */
  sanitizedValues: Record<string, unknown>;
}

/**
 * Dynamic Form Validator — server-side validation for any service form.
 *
 * This is the SINGLE SOURCE OF TRUTH for form validation. The frontend may
 * validate too (for UX), but the backend ALWAYS re-validates — never trust
 * client data.
 *
 * Validation flow:
 *  1. Required check: if field.required && value missing → error
 *  2. Type check: e.g. email field must look like email, phone like Iranian phone
 *  3. Validation rules: min, max, pattern, enum (for select)
 *  4. Options check: for select/multi/radio/checkbox — values must match allowed options
 *
 * If all pass, sanitize (convert types, trim strings, etc.) and return.
 */
@Injectable()
export class DynamicFormValidator {
  private readonly logger = new Logger(DynamicFormValidator.name);

  validate(ctx: ValidationContext): ValidationResult {
    const errors: FieldError[] = [];
    const sanitized: Record<string, unknown> = {};

    for (const field of ctx.fields) {
      const raw = ctx.values[field.name];
      const isEmpty = raw === undefined || raw === null || raw === '' ||
        (Array.isArray(raw) && raw.length === 0);

      // Required check
      if (field.required && isEmpty) {
        errors.push({
          field: field.name,
          message: field.validationRules?.find((r) => r.type === 'required')?.message ??
            `پر کردن فیلد «${field.label}» الزامی است`,
        });
        continue;
      }

      // If empty and not required, skip type checks
      if (isEmpty) {
        sanitized[field.name] = raw === undefined ? null : raw;
        continue;
      }

      // Type-specific validation + sanitization
      try {
        sanitized[field.name] = this.validateByType(field, raw);
      } catch (err) {
        errors.push({
          field: field.name,
          message: err instanceof Error ? err.message : 'مقدار نامعتبر است',
        });
        continue;
      }

      // Validation rules
      if (field.validationRules) {
        for (const rule of field.validationRules) {
          const error = this.applyRule(field, rule, sanitized[field.name]);
          if (error) {
            errors.push({ field: field.name, message: error });
            break; // First failing rule wins per field
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedValues: sanitized,
    };
  }

  // ==================== TYPE VALIDATORS ====================

  private validateByType(field: FieldDefinition, value: unknown): unknown {
    switch (field.type) {
      case ServiceFieldType.TEXT:
      case ServiceFieldType.TEXTAREA:
        return this.validateText(value);

      case ServiceFieldType.NUMBER:
        return this.validateNumber(value);

      case ServiceFieldType.EMAIL:
        return this.validateEmail(value);

      case ServiceFieldType.PHONE:
        return this.validatePhone(value);

      case ServiceFieldType.DATE:
        return this.validateDate(value);

      case ServiceFieldType.TIME:
        return this.validateTime(value);

      case ServiceFieldType.DATETIME:
        return this.validateDateTime(value);

      case ServiceFieldType.SELECT:
      case ServiceFieldType.RADIO:
        return this.validateSelect(field, value, false);

      case ServiceFieldType.MULTISELECT:
      case ServiceFieldType.CHECKBOX:
        return this.validateSelect(field, value, true);

      case ServiceFieldType.FILE:
      case ServiceFieldType.IMAGE:
        // File validation happens during upload — here just verify it's a file ID
        return this.validateFileReference(value);

      default:
        throw new BadRequestException(`نوع فیلد پشتیبانی نمی‌شود: ${field.type}`);
    }
  }

  private validateText(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('مقدار باید رشته متنی باشد');
    }
    return value.trim();
  }

  private validateNumber(value: unknown): number {
    const n = Number(value);
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      throw new BadRequestException('مقدار باید عدد باشد');
    }
    return n;
  }

  private validateEmail(value: unknown): string {
    if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new BadRequestException('فرمت ایمیل نامعتبر است');
    }
    return value.trim().toLowerCase();
  }

  private validatePhone(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('تلفن باید رشته باشد');
    }
    const normalized = value.replace(/[\s-]/g, '');
    if (!/^(\+?98|0)?9\d{9}$/.test(normalized)) {
      throw new BadRequestException('فرمت تلفن ایرانی نامعتبر است (مثال: 09123456789)');
    }
    // Normalize to 09xxxxxxxxx
    return normalized.replace(/^(\+?98)/, '0');
  }

  private validateDate(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('تاریخ باید رشته باشد (YYYY-MM-DD)');
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
      throw new BadRequestException('فرمت تاریخ نامعتبر است (YYYY-MM-DD)');
    }
    return value;
  }

  private validateTime(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('زمان باید رشته باشد (HH:MM)');
    }
    if (!/^([01]?\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw new BadRequestException('فرمت زمان نامعتبر است (HH:MM)');
    }
    return value;
  }

  private validateDateTime(value: unknown): string {
    if (typeof value !== 'string') {
      throw new BadRequestException('تاریخ-زمان باید رشته باشد (ISO 8601)');
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new BadRequestException('فرمت تاریخ-زمان نامعتبر است (ISO 8601)');
    }
    return d.toISOString();
  }

  private validateSelect(field: FieldDefinition, value: unknown, multiple: boolean): string | string[] {
    if (!field.options || field.options.length === 0) {
      throw new BadRequestException('گزینه‌های فیلد تعریف نشده‌اند');
    }
    const allowedValues = field.options.map((o) => o.value);

    if (multiple) {
      if (!Array.isArray(value)) {
        throw new BadRequestException('باید آرایه‌ای از مقادیر باشد');
      }
      const invalid = value.filter((v) => !allowedValues.includes(String(v)));
      if (invalid.length > 0) {
        throw new BadRequestException(`مقادیر نامعتبر: ${invalid.join('، ')}`);
      }
      return value.map((v) => String(v));
    } else {
      const strValue = String(value);
      if (!allowedValues.includes(strValue)) {
        throw new BadRequestException('مقدار انتخاب‌شده در گزینه‌ها وجود ندارد');
      }
      return strValue;
    }
  }

  private validateFileReference(value: unknown): string {
    // Value should be a file_upload ID (string of BigInt)
    if (typeof value !== 'string' || !/^\d+$/.test(value)) {
      throw new BadRequestException('فیلد فایل باید شامل ID فایل آپلود‌شده باشد');
    }
    return value;
  }

  // ==================== RULE VALIDATORS ====================

  private applyRule(
    field: FieldDefinition,
    rule: { type: string; params?: Record<string, unknown>; message?: string },
    value: unknown,
  ): string | null {
    switch (rule.type) {
      case 'min': {
        // For strings: min length. For numbers: min value.
        if (typeof value === 'string') {
          const min = Number(rule.params?.value ?? rule.params?.length ?? 0);
          if (value.length < min) {
            return rule.message ?? `حداقل ${min} کاراکتر`;
          }
        } else if (typeof value === 'number') {
          const min = Number(rule.params?.value ?? 0);
          if (value < min) {
            return rule.message ?? `حداقل مقدار: ${min}`;
          }
        }
        return null;
      }
      case 'max': {
        if (typeof value === 'string') {
          const max = Number(rule.params?.value ?? rule.params?.length ?? 1000);
          if (value.length > max) {
            return rule.message ?? `حداکثر ${max} کاراکتر`;
          }
        } else if (typeof value === 'number') {
          const max = Number(rule.params?.value ?? 0);
          if (value > max) {
            return rule.message ?? `حداکثر مقدار: ${max}`;
          }
        }
        return null;
      }
      case 'pattern': {
        const regexStr = rule.params?.regex as string | undefined;
        if (!regexStr) return null;
        try {
          const re = new RegExp(regexStr);
          if (typeof value === 'string' && !re.test(value)) {
            return rule.message ?? 'فرمت نامعتبر است';
          }
        } catch {
          this.logger.warn(`Invalid regex in rule for field ${field.name}: ${regexStr}`);
        }
        return null;
      }
      case 'enum': {
        const allowed = (rule.params?.values as string[] | undefined) ?? [];
        if (!allowed.includes(String(value))) {
          return rule.message ?? 'مقدار مجاز نیست';
        }
        return null;
      }
      case 'confirmed': {
        // For password confirmation — value should equal another field's value
        // params.field contains the field name to compare with
        return null; // handled separately in DTO
      }
      default:
        this.logger.warn(`Unknown validation rule type: ${rule.type}`);
        return null;
    }
  }
}
