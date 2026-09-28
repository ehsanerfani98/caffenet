import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

/**
 * Permissions guard — granular RBAC check.
 * Usage:
 *   @Permissions('services.update')
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *
 * A user passes if they have ANY of the listed permissions (OR semantics).
 * For AND semantics, use multiple @Permissions() decorators on different methods
 * or compose at the route level.
 *
 * Must be combined with JwtAuthGuard (which sets request.user with permissions[]).
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { permissions?: string[] } | undefined;
    if (!user?.permissions) {
      throw new ForbiddenException('دسترسی غیرمجاز — دسترسی کافی نیست');
    }

    // Admin role bypasses all permission checks
    if (user.permissions.includes('*') || (request.user as { roles?: string[] }).roles?.includes('admin')) {
      return true;
    }

    const hasAny = required.some((p) => user.permissions!.includes(p));
    if (!hasAny) {
      throw new ForbiddenException(
        `برای این عملیات یکی از دسترسی‌های زیر لازم است: ${required.join('، ')}`,
      );
    }
    return true;
  }
}
