import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Roles guard — restricts access to users with one of the allowed roles.
 * Usage:
 *   @Roles('admin', 'operator')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *
 * Must be combined with JwtAuthGuard (which sets request.user).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { roles?: string[] } | undefined;
    if (!user?.roles) {
      throw new ForbiddenException('دسترسی غیرمجاز — نقش کاربری کافی نیست');
    }

    const hasRole = user.roles.some((role) => requiredRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(`برای این عملیات یکی از نقش‌های زیر لازم است: ${requiredRoles.join(', ')}`);
    }
    return true;
  }
}
