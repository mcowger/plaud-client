import { describe, expect, it } from "bun:test";
import {
  extractSummaryNotes,
  fileDetailToMarkdown,
  formatDisplayTimestamp,
  formatDuration,
  formatSrtTimestamp,
  parseTranscriptSegments,
  segmentsToMarkdown,
  segmentsToSrt,
  segmentsToText,
} from "../src/formatters.js";
import type { FileDetail, Segment } from "../src/types.js";

describe("Formatters & Helpers", () => {
  it("formats SRT timestamps correctly", () => {
    expect(formatSrtTimestamp(0)).toBe("00:00:00,000");
    expect(formatSrtTimestamp(123456)).toBe("00:02:03,456");
    expect(formatSrtTimestamp(3661005)).toBe("01:01:01,005");
  });

  it("formats display timestamps correctly", () => {
    expect(formatDisplayTimestamp(0)).toBe("00:00");
    expect(formatDisplayTimestamp(65000)).toBe("01:05");
    expect(formatDisplayTimestamp(3665000)).toBe("01:01:05");
  });

  it("formats duration strings correctly", () => {
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3665)).toBe("1h 1m 5s");
  });

  it("parses transcript segments from JSON stringified source list", () => {
    const sourceList = [
      {
        data_type: "transcript",
        data_content: JSON.stringify([
          { start_time: 2000, end_time: 4000, speaker: "Speaker 2", content: "Second" },
          { start_time: 0, end_time: 1500, speaker: "Speaker 1", content: "First" },
        ]),
      },
    ];

    const segments = parseTranscriptSegments(sourceList);
    expect(segments.length).toBe(2);
    expect(segments[0].content).toBe("First"); // Sorted by start_time
    expect(segments[1].content).toBe("Second");
  });

  it("extracts summary notes from note list", () => {
    const noteList = [
      {
        data_type: "summary",
        data_content: "### Key Points\n- Item 1\n- Item 2",
      },
      {
        data_type: "mindmap",
        data_content: JSON.stringify({ content: "Root -> Node A" }),
      },
    ];

    const notes = extractSummaryNotes(noteList);
    expect(notes.length).toBe(2);
    expect(notes[0].type).toBe("summary");
    expect(notes[0].content).toContain("Key Points");
    expect(notes[1].content).toBe("Root -> Node A");
  });

  it("formats segments into plain text, SRT, and markdown", () => {
    const segments: Segment[] = [
      { start_time: 1000, end_time: 3000, speaker: "Speaker 1", content: "Hello team" },
      { start_time: 3500, end_time: 5000, speaker: "Speaker 2", content: "Hi everyone" },
    ];

    const text = segmentsToText(segments, { "Speaker 1": "Alice" });
    expect(text).toContain("Alice: Hello team");
    expect(text).toContain("Speaker 2: Hi everyone");

    const srt = segmentsToSrt(segments, { "Speaker 1": "Alice" });
    expect(srt).toContain("1\n00:00:01,000 --> 00:00:03,000\n[Alice] Hello team");

    const md = segmentsToMarkdown(segments, { speakerMap: { "Speaker 2": "Bob" } });
    expect(md).toContain("**Speaker 1** [00:01]");
    expect(md).toContain("**Bob** [00:03]");
  });

  it("formats entire FileDetail to comprehensive markdown document", () => {
    const file: FileDetail = {
      id: "REC_FILE_99",
      name: "Q3 Strategy Meeting",
      created_at: "2026-08-11T14:00:00Z",
      duration: 3600,
      serial_number: "PLAUD-1234",
      presigned_url: "https://audio.plaud.ai/rec.mp3",
      source_list: [
        {
          data_type: "transcript",
          data_content: JSON.stringify([
            { start_time: 0, end_time: 2000, speaker: "Speaker 1", content: "Welcome to Q3 planning." },
          ]),
        },
      ],
      note_list: [
        {
          data_type: "summary",
          data_content: "Discussion focused on expansion goals.",
        },
      ],
    };

    const doc = fileDetailToMarkdown(file, { speakerMap: { "Speaker 1": "CEO" } });

    expect(doc).toContain("# Q3 Strategy Meeting");
    expect(doc).toContain("- **ID:** `REC_FILE_99`");
    expect(doc).toContain("- **Device Serial:** `PLAUD-1234`");
    expect(doc).toContain("## Summary");
    expect(doc).toContain("Discussion focused on expansion goals.");
    expect(doc).toContain("## Transcript");
    expect(doc).toContain("**CEO** [00:00]");
    expect(doc).toContain("Welcome to Q3 planning.");
  });
});
