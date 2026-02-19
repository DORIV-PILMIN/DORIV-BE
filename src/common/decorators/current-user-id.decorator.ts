import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

export const CurrentUserId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<{ user?: { userId?: string } }>();
  const userId = request.user?.userId;
  if (!userId) {
    throw new UnauthorizedException('Authentication context is missing.');
  }
  return userId;
});
