import { describe, expect, it } from "bun:test";
import {
  CurrentUserSchema,
  FileDetailSchema,
  FileSummarySchema,
  FilesPageSchema,
  SegmentSchema,
  TokenResponseSchema,
  TokenSetSchema,
} from "../src/schemas.js";

describe("Zod Schemas", () => {
  it("parses TokenResponse with defaults", () => {
    const input = {
      access_token: "acc_123",
      refresh_token: "ref_456",
      expires_in: 3600,
      unknown_field: "allowed_due_to_passthrough",
    };

    const parsed = TokenResponseSchema.parse(input);
    expect(parsed.access_token).toBe("acc_123");
    expect(parsed.refresh_token).toBe("ref_456");
    expect(parsed.token_type).toBe("Bearer");
    expect((parsed as Record<string, unknown>).unknown_field).toBe("allowed_due_to_passthrough");
  });

  it("parses TokenSet with expires_at", () => {
    const input = {
      access_token: "acc_123",
      token_type: "Bearer",
      expires_at: 1700000000000,
    };

    const parsed = TokenSetSchema.parse(input);
    expect(parsed.access_token).toBe("acc_123");
    expect(parsed.expires_at).toBe(1700000000000);
  });

  it("parses CurrentUser profile", () => {
    const input = {
      id: "usr_99",
      email: "test@example.com",
      username: "testuser",
    };

    const parsed = CurrentUserSchema.parse(input);
    expect(parsed.id).toBe("usr_99");
    expect(parsed.email).toBe("test@example.com");
  });

  it("parses FileSummary and FilesPage", () => {
    const input = {
      data: [
        {
          id: "rec_1",
          name: "Test Recording",
          created_at: "2026-08-11T12:00:00Z",
          duration: 120000,
        },
      ],
      page: 1,
      total: 1,
    };

    const parsed = FilesPageSchema.parse(input);
    expect(parsed.data.length).toBe(1);
    expect(parsed.data[0].id).toBe("rec_1");
    expect(parsed.data[0].name).toBe("Test Recording");
  });

  it("parses FileDetail with source_list and note_list", () => {
    const input = {
      id: "rec_detail_1",
      name: "Detail Recording",
      presigned_url: "https://s3.amazonaws.com/audio.mp3",
      source_list: [
        {
          data_type: "transcript",
          data_content: JSON.stringify([
            { start_time: 0, end_time: 1000, speaker: "Speaker 1", content: "Hello" },
          ]),
        },
      ],
      note_list: [
        {
          data_type: "summary",
          data_content: "This is a summary note.",
        },
      ],
    };

    const parsed = FileDetailSchema.parse(input);
    expect(parsed.id).toBe("rec_detail_1");
    expect(parsed.source_list.length).toBe(1);
    expect(parsed.note_list.length).toBe(1);
    expect(parsed.presigned_url).toContain("s3.amazonaws.com");
  });

  it("parses SegmentSchema correctly", () => {
    const input = {
      start_time: 1500,
      end_time: 3000,
      speaker: "Speaker A",
      content: "Hello world!",
    };

    const parsed = SegmentSchema.parse(input);
    expect(parsed.start_time).toBe(1500);
    expect(parsed.end_time).toBe(3000);
    expect(parsed.speaker).toBe("Speaker A");
    expect(parsed.content).toBe("Hello world!");
  });
});
