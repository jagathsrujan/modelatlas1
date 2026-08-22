export interface TranscriptionResult {
  transcript: string;
  language?: string;
  confidence?: number;
}

export interface TranscriptionProvider {
  transcribe(audio: Blob, opts?: { sessionId?: string; language?: string }): Promise<TranscriptionResult>;
}

// Server-only: self-hosted Whisper / Parakeet
// P1 impl uses whisper.cpp or parakeet-tdt-1.1b small behind POST /api/transcribe
// Browser never sends raw docs for confidential — only metadata (handled by caller)
export class WhisperLargeV3Local implements TranscriptionProvider {
  constructor(private endpoint?: string) {}
  async transcribe(audio: Blob, opts?: { sessionId?: string; language?: string }): Promise<TranscriptionResult> {
    // In production, this would call self-hosted whisper.cpp
    // For now, return a mock transcript (P0 fallback)
    // The actual transcription is done server-side via /api/transcribe
    throw new Error("WhisperLargeV3Local.transcribe should be called via POST /api/transcribe server route, not directly in browser");
  }
}

// Deterministic fallback for demo / offline
export class MockTranscriptionProvider implements TranscriptionProvider {
  async transcribe(_audio: Blob): Promise<TranscriptionResult> {
    return {
      transcript: "Mock transcript — please edit before submission (FR-02). In production, this would be Whisper Large v3 / Parakeet TDT 1.1B.",
      language: "en",
      confidence: 0.9,
    };
  }
}

export const mockTranscriptionProvider = new MockTranscriptionProvider();
