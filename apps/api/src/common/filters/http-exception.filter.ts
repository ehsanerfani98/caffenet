import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

import { ERROR_CODES } from '@caffenet/shared';

interface StandardError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown> | Array<Record<string, unknown>>;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    const timestamp = new Date().toISOString();

    let status: number;
    let payload: StandardError;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const expResponse = exception.getResponse();
      const expMessage =
        typeof expResponse === 'string' ? expResponse : (expResponse as Record<string, unknown>).message;

      // Validation errors (class-validator)
      if (
        status === HttpStatus.BAD_REQUEST &&
        Array.isArray((expResponse as Record<string, unknown>).message)
      ) {
        const messages = (expResponse as { message: string[] }).message;
        payload = {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'مقادیر ورودی نامعتبر است',
            details: messages.map((m) => ({ message: m })),
          },
          meta: { requestId, timestamp },
        };
      } else {
        // Other HTTP exceptions
        const code = this.getCodeForStatus(status);
        payload = {
          success: false,
          error: {
            code,
            message: (expMessage as string) || 'خطای غیرمنتظره رخ داد',
          },
          meta: { requestId, timestamp },
        };
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma errors
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      payload = {
        success: false,
        error: mapped.error,
        meta: { requestId, timestamp },
      };
    } else {
      // Unknown error
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      payload = {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_ERROR,
          message: 'خطای داخلی سرور',
        },
        meta: { requestId, timestamp },
      };

      // Log full stack to server, NOT to client
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status} [${requestId}]`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else if (status >= 400) {
      this.logger.warn(`${request.method} ${request.url} → ${status} [${requestId}]`);
    }

    response.status(status).json(payload);
  }

  private getCodeForStatus(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.INVALID_REQUEST;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return ERROR_CODES.BUSINESS_RULE_VIOLATION;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      default:
        return ERROR_CODES.INTERNAL_ERROR;
    }
  }

  private mapPrismaError(
    error: Prisma.PrismaClientKnownRequestError,
  ): { status: number; error: { code: string; message: string } } {
    switch (error.code) {
      case 'P2002': // unique constraint violation
        return {
          status: HttpStatus.CONFLICT,
          error: {
            code: ERROR_CODES.DUPLICATE_RESOURCE,
            message: 'این منبع قبلاً ثبت شده است',
          },
        };
      case 'P2025': // record not found
        return {
          status: HttpStatus.NOT_FOUND,
          error: {
            code: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: 'منبع درخواست‌شده یافت نشد',
          },
        };
      case 'P2003': // foreign key constraint
        return {
          status: HttpStatus.CONFLICT,
          error: {
            code: ERROR_CODES.CONFLICT,
            message: 'به دلیل وابستگی به منابع دیگر، امکان حذف وجود ندارد',
          },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: {
            code: ERROR_CODES.INTERNAL_ERROR,
            message: 'خطای پایگاه داده',
          },
        };
    }
  }
}
