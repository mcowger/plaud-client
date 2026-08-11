import { SegmentSchema } from "./schemas.js";
import type { DataItem, FileDetail, Segment } from "./types.js";

/**
 * Format milliseconds into SRT timestamp format: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);
  const milliseconds = totalMs % 1000;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const mmm = String(milliseconds).padStart(3, "0");

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Format milliseconds into display timestamp: [HH:MM:SS] or [MM:SS]
 */
export function formatDisplayTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Format duration in milliseconds or seconds to readable string (e.g. "1h 23m 45s")
 */
export function formatDuration(duration: number | null | undefined): string {
  if (duration === null || duration === undefined || isNaN(duration)) {
    return "0s";
  }

  // Auto-detect if duration is in seconds or milliseconds
  let ms = duration;
  if (duration < 86400 * 10) {
    // If less than ~100000, assume seconds unless explicitly 0
    ms = duration * 1000;
  }

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(" ");
}

/**
 * Safely parse transcript segments from `FileDetail.source_list`
 */
export function parseTranscriptSegments(sourceList: DataItem[] = []): Segment[] {
  const segments: Segment[] = [];

  for (const item of sourceList) {
    if (!item.data_content) continue;

    try {
      const parsed = JSON.parse(item.data_content);
      if (Array.isArray(parsed)) {
        for (const element of parsed) {
          const result = SegmentSchema.safeParse(element);
          if (result.success) {
            segments.push(result.data);
          }
        }
      } else if (typeof parsed === "object" && parsed !== null) {
        const result = SegmentSchema.safeParse(parsed);
        if (result.success) {
          segments.push(result.data);
        }
      }
    } catch {
      // If data_content is plain text instead of JSON
      segments.push({
        start_time: 0,
        end_time: 0,
        speaker: null,
        content: item.data_content.trim(),
      });
    }
  }

  // Sort segments by start_time
  return segments.sort((a, b) => a.start_time - b.start_time);
}

/**
 * Extract summary notes from `FileDetail.note_list`
 */
export function extractSummaryNotes(noteList: DataItem[] = []): { type: string; content: string }[] {
  return noteList
    .filter((item) => Boolean(item.data_content))
    .map((item) => {
      let content = item.data_content;
      try {
        const parsed = JSON.parse(item.data_content);
        if (typeof parsed === "string") {
          content = parsed;
        } else if (parsed && typeof parsed === "object") {
          content = parsed.content || parsed.summary || parsed.markdown || JSON.stringify(parsed, null, 2);
        }
      } catch {
        // Already plain text/markdown
      }
      return {
        type: item.data_type || "summary",
        content: content.trim(),
      };
    });
}

/**
 * Convert transcript segments to plain text string
 */
export function segmentsToText(
  segments: Segment[],
  speakerMap?: Record<string, string>
): string {
  return segments
    .map((seg) => {
      const speakerRaw = seg.speaker || "Speaker";
      const speaker = speakerMap?.[speakerRaw] || speakerRaw;
      return `${speaker}: ${seg.content}`;
    })
    .join("\n\n");
}

/**
 * Convert transcript segments to SubRip (SRT) string
 */
export function segmentsToSrt(
  segments: Segment[],
  speakerMap?: Record<string, string>
): string {
  return segments
    .map((seg, idx) => {
      const seq = idx + 1;
      const start = formatSrtTimestamp(seg.start_time);
      const end = formatSrtTimestamp(seg.end_time);
      const speakerRaw = seg.speaker;
      const speaker = speakerRaw ? (speakerMap?.[speakerRaw] || speakerRaw) : null;
      const textLine = speaker ? `[${speaker}] ${seg.content}` : seg.content;

      return `${seq}\n${start} --> ${end}\n${textLine}`;
    })
    .join("\n\n");
}

/**
 * Convert transcript segments to formatted Markdown string
 */
export function segmentsToMarkdown(
  segments: Segment[],
  options: {
    includeTimestamps?: boolean;
    speakerMap?: Record<string, string>;
  } = {}
): string {
  const includeTimestamps = options.includeTimestamps ?? true;
  const speakerMap = options.speakerMap;

  return segments
    .map((seg) => {
      const speakerRaw = seg.speaker || "Speaker";
      const speaker = speakerMap?.[speakerRaw] || speakerRaw;
      const ts = includeTimestamps ? ` [${formatDisplayTimestamp(seg.start_time)}]` : "";
      return `**${speaker}**${ts}\n${seg.content}`;
    })
    .join("\n\n");
}

/**
 * Convert a complete `FileDetail` into a comprehensive Markdown document
 */
export function fileDetailToMarkdown(
  file: FileDetail,
  options: {
    speakerMap?: Record<string, string>;
    includeRawPayload?: boolean;
  } = {}
): string {
  const title = file.name || `Recording ${file.id}`;
  const segments = parseTranscriptSegments(file.source_list);
  const notes = extractSummaryNotes(file.note_list);

  const lines: string[] = [];

  // Title
  lines.push(`# ${title}\n`);

  // Metadata Block
  lines.push("## Metadata\n");
  lines.push(`- **ID:** \`${file.id}\``);
  if (file.created_at) lines.push(`- **Created At:** ${file.created_at}`);
  if (file.start_at) lines.push(`- **Start At:** ${file.start_at}`);
  if (file.duration) lines.push(`- **Duration:** ${formatDuration(file.duration)}`);
  if (file.serial_number) lines.push(`- **Device Serial:** \`${file.serial_number}\``);
  lines.push("");

  // Summary / Notes Sections
  if (notes.length > 0) {
    for (const note of notes) {
      const sectionTitle = note.type.charAt(0).toUpperCase() + note.type.slice(1);
      lines.push(`## ${sectionTitle}\n`);
      lines.push(note.content);
      lines.push("");
    }
  }

  // Transcript Section
  if (segments.length > 0) {
    lines.push("## Transcript\n");
    lines.push(segmentsToMarkdown(segments, { speakerMap: options.speakerMap }));
    lines.push("");
  }

  return lines.join("\n");
}
