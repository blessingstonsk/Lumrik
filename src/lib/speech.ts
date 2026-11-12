"use client";
/**
 * Browser speech helpers.
 *  - Text-to-speech via the Web Speech API (speechSynthesis), or an uploaded audio file if present.
 *  - Speech recognition via (webkit)SpeechRecognition – Chrome, Edge and Safari. Firefox has no support,
 *    so callers must handle `isRecognitionSupported() === false` gracefully.
 *  - Recording via MediaRecorder so learners can play back their own voice.
 */
import * as React from "react";

export function isTtsSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function pickVoice(locale: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const lang = locale.toLowerCase();
  const base = lang.split("-")[0];
  return (
    voices.find((v) => v.lang.toLowerCase() === lang && /natural|google|enhanced|premium/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase() === lang) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(base))
  );
}

let currentAudio: HTMLAudioElement | null = null;

export function speak(text: string, opts: { locale?: string; rate?: number; audioUrl?: string | null } = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (opts.audioUrl) {
      currentAudio?.pause();
      currentAudio = new Audio(opts.audioUrl);
      currentAudio.onended = () => resolve();
      currentAudio.onerror = () => reject(new Error("Could not play audio"));
      void currentAudio.play().catch(reject);
      return;
    }
    if (!isTtsSupported()) return reject(new Error("Text-to-speech isn't supported in this browser."));
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = opts.locale ?? "en-US";
    u.rate = opts.rate ?? 0.95;
    const voice = pickVoice(u.lang);
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = (e) => (e.error === "interrupted" || e.error === "canceled" ? resolve() : reject(new Error(e.error)));
    synth.speak(u);
  });
}

/** Hook: speak with a loading flag and error state. */
export function useSpeaker(locale = "en-US") {
  const [speaking, setSpeaking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    // Voices load asynchronously in Chrome.
    if (isTtsSupported()) window.speechSynthesis.getVoices();
  }, []);
  const say = React.useCallback(
    async (text: string, opts: { rate?: number; audioUrl?: string | null } = {}) => {
      setError(null);
      setSpeaking(true);
      try {
        await speak(text, { locale, ...opts });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSpeaking(false);
      }
    },
    [locale],
  );
  return { say, speaking, error, supported: isTtsSupported() };
}

// ── Speech recognition ───────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
function recognitionCtor(): any {
  if (typeof window === "undefined") return null;
  return (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;
}

export function isRecognitionSupported() {
  return !!recognitionCtor();
}

export type RecognizerStatus = "idle" | "listening" | "processing" | "error";

/** Hook: listen once, capture transcript + optional audio recording for playback. */
export function useRecognizer(locale = "en-US") {
  const [status, setStatus] = React.useState<RecognizerStatus>("idle");
  const [transcript, setTranscript] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = React.useState<string | null>(null);
  const recRef = React.useRef<any>(null);
  const mediaRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const supported = typeof window !== "undefined" && isRecognitionSupported();

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  React.useEffect(
    () => () => {
      recRef.current?.abort?.();
      cleanupStream();
    },
    [],
  );

  const start = React.useCallback(async (): Promise<string> => {
    setError(null);
    setTranscript("");
    if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    setRecordingUrl(null);
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setStatus("error");
      setError("Speech recognition isn't supported in this browser. Try Chrome, Edge or Safari.");
      return "";
    }
    // Ask for the microphone explicitly first so permission errors are clear, and record for playback.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (typeof MediaRecorder !== "undefined") {
        const chunks: Blob[] = [];
        const mr = new MediaRecorder(stream);
        mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        mr.onstop = () => {
          if (chunks.length) setRecordingUrl(URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || "audio/webm" })));
          cleanupStream();
        };
        mr.start();
        mediaRef.current = mr;
      }
    } catch (e) {
      setStatus("error");
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser's site settings, then try again."
          : name === "NotFoundError"
            ? "No microphone was found on this device."
            : "Could not access the microphone.",
      );
      return "";
    }

    return new Promise<string>((resolve) => {
      const rec = new Ctor();
      recRef.current = rec;
      rec.lang = locale;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.continuous = false;
      let finalText = "";
      rec.onresult = (event: any) => {
        let text = "";
        for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
        finalText = text;
        setTranscript(text);
      };
      rec.onerror = (event: any) => {
        const msg: Record<string, string> = {
          "no-speech": "We didn't hear anything. Try again and speak a little louder.",
          "not-allowed": "Microphone access was blocked.",
          network: "Speech recognition needs an internet connection in this browser.",
          "audio-capture": "No microphone was found.",
        };
        setError(msg[event.error] ?? `Speech recognition error: ${event.error}`);
        setStatus("error");
      };
      rec.onend = () => {
        if (mediaRef.current?.state === "recording") mediaRef.current.stop();
        else cleanupStream();
        setStatus((s) => (s === "error" ? s : "idle"));
        resolve(finalText);
      };
      setStatus("listening");
      rec.start();
    });
  }, [locale, recordingUrl]);

  const stop = React.useCallback(() => {
    recRef.current?.stop?.();
  }, []);

  return { supported, status, transcript, error, recordingUrl, start, stop, setTranscript };
}
