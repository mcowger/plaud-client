import { z } from "zod";

/**
 * Zod schema for OAuth token API response
 */
export const TokenResponseSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
    token_type: z.string().optional().default("Bearer"),
    expires_in: z.number().optional(), // in seconds
  })
  .passthrough();

/**
 * Zod schema for persisted TokenSet
 */
export const TokenSetSchema = z
  .object({
    access_token: z.string(),
    refresh_token: z.string().optional(),
    token_type: z.string().default("Bearer"),
    expires_at: z.number().optional(), // Unix timestamp in ms
  })
  .passthrough();

/**
 * Zod schema for Current User response
 */
export const CurrentUserSchema = z
  .object({
    id: z.string().optional(),
    email: z.string().optional(),
    username: z.string().optional(),
    nickname: z.string().optional(),
    avatar: z.string().optional(),
  })
  .passthrough();

/**
 * Zod schema for File Summary item in listing
 */
export const FileSummarySchema = z
  .object({
    id: z.string(),
    name: z.string().nullish(),
    created_at: z.string().nullish(),
    start_at: z.string().nullish(),
    duration: z.number().nullish(),
    serial_number: z.string().nullish(),
  })
  .passthrough();

/**
 * Zod schema for Files Page response
 */
export const FilesPageSchema = z
  .object({
    data: z.array(FileSummarySchema).default([]),
    page: z.number().default(1),
    page_size: z.number().optional(),
    total: z.number().optional(),
  })
  .passthrough();

/**
 * Zod schema for DataItem inside source_list / note_list
 */
export const DataItemSchema = z
  .object({
    data_type: z.string().default(""),
    data_content: z.string().default(""),
  })
  .passthrough();

/**
 * Zod schema for File Detail
 */
export const FileDetailSchema = z
  .object({
    id: z.string(),
    name: z.string().nullish(),
    created_at: z.string().nullish(),
    start_at: z.string().nullish(),
    duration: z.number().nullish(),
    serial_number: z.string().nullish(),
    presigned_url: z.string().nullish(),
    source_list: z.array(DataItemSchema).default([]),
    note_list: z.array(DataItemSchema).default([]),
  })
  .passthrough();

/**
 * Zod schema for a Transcript Segment
 */
export const SegmentSchema = z
  .object({
    start_time: z.number().default(0),
    end_time: z.number().default(0),
    speaker: z.string().nullish(),
    content: z.string().default(""),
  })
  .passthrough();
