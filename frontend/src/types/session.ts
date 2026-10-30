import { User } from '@/types/api';

// 'loading' covers the gap before auth resolves (Phase 5), so signed-in users never see "Log in" flash.
export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; user: User };

export type SessionStatus = SessionState['status'];
