import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { AUDIT_LOG_KEY, AuditLogMetadata } from './audit.decorator';
import { AuditService } from './audit.service';

/**
 * Audit interceptor — auto-writes audit log entries for endpoints decorated with @AuditLog().
 *
 * Usage:
 *   @AuditLog({ action: AuditAction.PRICE_CHANGE, entity: 'request_cost' })
 *   @UseInterceptors(AuditInterceptor)
 *   @Patch('requests/:id/costs')
 *
 * Behavior:
 *  - On successful response, writes an audit log with old/new data
 *  - On error, NO audit log is written (the operation didn't succeed)
 *  - The interceptor automatically captures: user, IP, user agent, request ID
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditLogMetadata | undefined>(AUDIT_LOG_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const user = (req as unknown as { user?: { id?: string } }).user;
    const requestId = req.headers['x-request-id'] as string | undefined;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Capture old data before handler runs (if extractor provided)
    const oldDataPromise = meta.oldDataExtractor ? Promise.resolve(meta.oldDataExtractor(req)) : Promise.resolve(undefined);

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const oldData = await oldDataPromise;
          const entityId = meta.entityIdExtractor ? meta.entityIdExtractor(req) : (req.params['id'] as string | undefined);
          await this.audit.log({
            userId: user?.id,
            action: meta.action,
            entity: meta.entity,
            entityId,
            oldData: oldData as Record<string, unknown> | undefined,
            newData: responseData as Record<string, unknown> | undefined,
            ip,
            userAgent,
            requestId,
          });
        } catch {
          // Silent — audit failure should never break the user-facing operation
        }
      }),
    );
  }
}
