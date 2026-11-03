export type SupportProvider = 'microsoft' | 'elyby' | 'offline';

export type SupportTicketStatus = 'open' | 'closed';

export interface SupportSession {
  name: string;
  provider: SupportProvider;
  isAdmin: boolean;
  verificationFailed: boolean;
}

export interface SupportTicket {
  id: string;
  authorName: string;
  authorProvider: SupportProvider;
  subject: string;
  status: SupportTicketStatus;
  hasLog: boolean;
  createdAt: number;
  updatedAt: number;
  unread: boolean;
  authorBlocked: boolean;
}

export interface SupportMessage {
  id: number;
  fromAdmin: boolean;
  authorName: string;
  text: string;
  createdAt: number;
}

export interface SupportThread {
  ticket: SupportTicket;
  meta: Record<string, string>;
  messages: SupportMessage[];
}

export interface SupportTicketDraft {
  subject: string;
  message: string;
  attachLog: boolean;
}
