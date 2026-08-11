import type { z } from "zod";
import type {
  CurrentUserSchema,
  DataItemSchema,
  FileDetailSchema,
  FileSummarySchema,
  FilesPageSchema,
  SegmentSchema,
  TokenResponseSchema,
  TokenSetSchema,
} from "./schemas.js";

export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type TokenSet = z.infer<typeof TokenSetSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type FileSummary = z.infer<typeof FileSummarySchema>;
export type FilesPage = z.infer<typeof FilesPageSchema>;
export type DataItem = z.infer<typeof DataItemSchema>;
export type FileDetail = z.infer<typeof FileDetailSchema>;
export type Segment = z.infer<typeof SegmentSchema>;

export interface ListFilesOptions {
  page?: number;
  pageSize?: number;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

export interface PlaudClientConfig {
  apiBase?: string;
  authUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  clientId?: string;
  redirectUri?: string;
  callbackPort?: number;
  timeoutMs?: number;
  maxRetries?: number;
  refreshWindowMs?: number;
  tokenStore?: TokenStore;
}

export interface TokenStore {
  load(): Promise<TokenSet | null> | TokenSet | null;
  save(tokens: TokenSet): Promise<void> | void;
  clear(): Promise<void> | void;
}
