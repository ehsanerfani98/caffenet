import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Restrict route to specific roles.
 * Usage: @Roles('admin') @Get('users')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
