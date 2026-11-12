import type { Language, LanguageCode } from "./types";

/**
 * Built-in language registry. In Supabase mode the `languages` table is the source of
 * truth (admins can add more); this list seeds it and is the fallback in local mode.
 */
export const LANGUAGES: (Language & { glyph: string })[] = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧", glyph: "Aa", script: "Latin", speechLocale: "en-US", enabled: true },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", flag: "🇮🇳", glyph: "அ", script: "Tamil", speechLocale: "ta-IN", enabled: true },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", flag: "🇮🇳", glyph: "अ", script: "Devanagari", speechLocale: "hi-IN", enabled: true },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", flag: "🇮🇳", glyph: "അ", script: "Malayalam", speechLocale: "ml-IN", enabled: true },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", flag: "🇮🇳", glyph: "అ", script: "Telugu", speechLocale: "te-IN", enabled: true },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", flag: "🇮🇳", glyph: "ಅ", script: "Kannada", speechLocale: "kn-IN", enabled: true },
  { code: "fr", name: "French", nativeName: "Français", flag: "🇫🇷", glyph: "Fr", script: "Latin", speechLocale: "fr-FR", enabled: true },
  { code: "es", name: "Spanish", nativeName: "Español", flag: "🇪🇸", glyph: "Es", script: "Latin", speechLocale: "es-ES", enabled: true },
  { code: "de", name: "German", nativeName: "Deutsch", flag: "🇩🇪", glyph: "De", script: "Latin", speechLocale: "de-DE", enabled: true },
  { code: "ja", name: "Japanese", nativeName: "日本語", flag: "🇯🇵", glyph: "あ", script: "Japanese", speechLocale: "ja-JP", enabled: true },
  { code: "ko", name: "Korean", nativeName: "한국어", flag: "🇰🇷", glyph: "한", script: "Hangul", speechLocale: "ko-KR", enabled: true },
];

export function getLanguage(code: LanguageCode | null | undefined) {
  return LANGUAGES.find((l) => l.code === code) ?? {
    code: code ?? "en",
    name: String(code ?? "Unknown"),
    nativeName: String(code ?? "Unknown"),
    flag: "🌐",
    glyph: String(code ?? "?").slice(0, 2),
    script: "Latin",
    speechLocale: String(code ?? "en"),
    enabled: true,
  };
}

/** CSS font stack per script so Unicode scripts render with a proper face. */
export function fontClassFor(code: LanguageCode) {
  switch (code) {
    case "ta": return "font-tamil";
    case "hi": return "font-devanagari";
    case "ml": return "font-malayalam";
    case "te": return "font-telugu";
    case "kn": return "font-kannada";
    case "ja": return "font-jp";
    case "ko": return "font-kr";
    default: return "";
  }
}
