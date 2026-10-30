export interface AccountRecord {
  status?: string;
  id: number; login: string; passwordHash: string; role: string; notes: string; characterLimit: number;
  ban: { startedAt?: Date | null; expiresAt?: Date | null; revokedAt?: Date | null; reason: string; issuedBy: number; revokedBy: number };
  createdAt?: Date; updatedAt?: Date; lastLoginAt?: Date | null;
}
export interface SessionRecord { tokenHash: string; accountId: number; expiresAt: Date }
