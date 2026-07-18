import type { Express, Request, Response } from "express";
import { transcribeAudio } from "./_core/voiceTranscription";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const multerLib = require("multer") as any;
const multer = multerLib.default ?? multerLib;
const memoryStorage = (multerLib.memoryStorage ?? multerLib.default?.memoryStorage);
const upload = multer({ storage: memoryStorage(), limits: { fileSize: 16 * 1024 * 1024 } });

// ElevenLabs voice IDs — higher-quality voices for NOVA.
const VOICE_OPTIONS: Record<string, string> = {
  brian: "nPczCjzI2devNBz1zQrb",    // Brian — polished, formal British narrator
  daniel: "onwK4e9ZLuTAKqWW03F9",   // Daniel — authoritative British
  george: "JBFqnCBsd6RMkjVDRZzb",   // George — warm British male
  charlie: "IKne3meq5aSn9XLyUdCD",  // Charlie — crisp British male
  adam: "pNInz6obpgDQGcFmaJgB",     // Adam — clear American fallback
  arnold: "VR6AewLTigWG4xSOukaG",   // Arnold — cinematic American
};

const DEFAULT_VOICE_ID = VOICE_OPTIONS.brian;
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

async function synthesizeWithElevenLabs(text: string, voiceId?: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;
  const selectedVoiceId = voiceId && VOICE_OPTIONS[voiceId] ? VOICE_OPTIONS[voiceId] : DEFAULT_VOICE_ID;
  const response = await fetch(`${ELEVENLABS_API_URL}/${selectedVoiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.58,
        similarity_boost: 0.88,
        style: 0.08,
        use_speaker_boost: true,
      },
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.warn("[TTS] ElevenLabs failed, falling back if possible:", response.status, errText.slice(0, 300));
    return null;
  }
  return response.arrayBuffer();
}

async function synthesizeWithOpenAI(text: string): Promise<ArrayBuffer | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1-hd",
      voice: "onyx",
      input: text,
      response_format: "mp3",
      speed: 0.95,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error("[TTS] OpenAI TTS error:", response.status, errText.slice(0, 300));
    return null;
  }
  return response.arrayBuffer();
}

export function registerTtsRoutes(app: Express) {
  app.post("/api/tts", async (req: Request, res: Response) => {
    const { text, voiceId } = req.body as { text?: string; voiceId?: string };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const truncated = text.trim().slice(0, 5000);

    try {
      // Prefer ElevenLabs. If unavailable/misconfigured, fall back to OpenAI TTS.
      const audioBuffer =
        (await synthesizeWithElevenLabs(truncated, voiceId)) ??
        (await synthesizeWithOpenAI(truncated));

      if (!audioBuffer || audioBuffer.byteLength < 100) {
        res.status(503).json({
          error: "TTS service not configured",
          detail: "Set ELEVENLABS_API_KEY or ensure OPENAI_API_KEY has TTS access.",
        });
        return;
      }

      res.set({
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.byteLength),
        "Cache-Control": "no-store",
        "X-TTS-Provider": process.env.ELEVENLABS_API_KEY ? "elevenlabs-or-openai" : "openai",
      });
      res.send(Buffer.from(audioBuffer));
    } catch (err) {
      console.error("[TTS] Request error:", err);
      res.status(500).json({ error: "TTS request failed" });
    }
  });

  // Whisper transcription endpoint — accepts raw audio blob from MediaRecorder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.post("/api/transcribe", upload.single("audio"), async (req: Request, res: Response) => {
    const file = (req as any).file as { buffer: Buffer; mimetype: string } | undefined;
    if (!file || !file.buffer || file.buffer.length === 0) {
      res.status(400).json({ error: "No audio file provided" });
      return;
    }

    try {
      const { storagePut, storageGetSignedUrl } = await import("./storage");
      const key = `transcriptions/tmp_${Date.now()}.webm`;
      const { key: storedKey } = await storagePut(key, file.buffer, file.mimetype || "audio/webm");
      const signedUrl = await storageGetSignedUrl(storedKey);

      const result = await transcribeAudio({ audioUrl: signedUrl, language: "en" });

      if ("error" in result) {
        console.error("[Transcribe] Whisper error:", result);
        res.status(500).json({ error: result.error });
        return;
      }

      res.json({ text: result.text, language: result.language });
    } catch (err) {
      console.error("[Transcribe] Error:", err);
      res.status(500).json({ error: "Transcription failed" });
    }
  });

  app.get("/api/tts/voices", (_req: Request, res: Response) => {
    res.json({
      voices: Object.entries(VOICE_OPTIONS).map(([key, id]) => ({
        key,
        id,
        label: key === "brian" ? "Brian (British, Premium Default)" : key.charAt(0).toUpperCase() + key.slice(1),
      })),
      default: "brian",
      providers: {
        elevenLabsConfigured: Boolean(process.env.ELEVENLABS_API_KEY),
        openAiConfigured: Boolean(process.env.OPENAI_API_KEY),
      },
    });
  });
}
