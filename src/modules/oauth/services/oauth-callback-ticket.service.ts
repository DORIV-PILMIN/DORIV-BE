import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { OauthLoginResponseDto } from '../dtos/oauth-login-response.dto';

type OauthCallbackTicketEntry = {
  response: OauthLoginResponseDto;
  expiresAt: number;
};

@Injectable()
export class OauthCallbackTicketService {
  private readonly tickets = new Map<string, OauthCallbackTicketEntry>();
  private readonly ticketTtlMs = 60 * 1000;

  constructor() {
    const cleanupTimer = setInterval(() => this.cleanupExpiredTickets(), 30_000);
    cleanupTimer.unref();
  }

  issue(response: OauthLoginResponseDto): string {
    const ticket = randomUUID();
    const expiresAt = Date.now() + this.ticketTtlMs;
    this.tickets.set(ticket, { response, expiresAt });
    return ticket;
  }

  consume(ticket: string): OauthLoginResponseDto {
    const entry = this.tickets.get(ticket);
    this.tickets.delete(ticket);

    if (!entry || entry.expiresAt <= Date.now()) {
      throw new UnauthorizedException('OAuth callback ticket is invalid.');
    }

    return entry.response;
  }

  private cleanupExpiredTickets(): void {
    const now = Date.now();
    for (const [ticket, entry] of this.tickets.entries()) {
      if (entry.expiresAt <= now) {
        this.tickets.delete(ticket);
      }
    }
  }
}
