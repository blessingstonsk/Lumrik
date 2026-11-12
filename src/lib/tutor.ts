/** Shared AI-tutor definitions (client + server). */

export interface Scenario {
  id: string;
  title: string;
  icon: string;
  setting: string; // instructions for the AI role-play
  opener: string; // suggested first learner message (English, shown as a hint)
}

export const SCENARIOS: Scenario[] = [
  { id: "free", title: "Free conversation", icon: "💬", setting: "A friendly open conversation about the learner's day, hobbies and interests. You are a curious, warm conversation partner.", opener: "Hi! How are you today?" },
  { id: "food", title: "Ordering food", icon: "🍽️", setting: "You are a waiter in a busy, friendly café. Greet the customer, offer the menu (coffee, tea, sandwiches, soup, cake), take their order and bring the bill when asked.", opener: "Hello, can I see the menu, please?" },
  { id: "airport", title: "At the airport", icon: "✈️", setting: "You are a check-in agent at an airport. Ask for the passport and destination, ask about luggage, give the gate number and boarding time.", opener: "Hi, I'd like to check in for my flight." },
  { id: "interview", title: "Job interview", icon: "💼", setting: "You are a polite hiring manager interviewing the learner for a job they choose. Ask about experience, strengths, and why they want the job – one question at a time.", opener: "Good morning, thank you for inviting me." },
  { id: "shopping", title: "Shopping", icon: "🛍️", setting: "You are a shop assistant in a clothes shop. Help the customer find items, discuss sizes, colours and prices, and handle payment.", opener: "Excuse me, do you have this shirt in blue?" },
  { id: "meeting", title: "Meeting new people", icon: "🤝", setting: "You are a friendly person the learner meets at a party. Introduce yourselves, ask where they're from, what they do and what they like.", opener: "Hi, I'm new here. What's your name?" },
  { id: "university", title: "University life", icon: "🎓", setting: "You are a fellow student on the first day at university. Talk about courses, timetables, the library and campus life.", opener: "Hi, is this the right room for the first lecture?" },
  { id: "travel", title: "Travel & directions", icon: "🗺️", setting: "You are a helpful local in a city the learner is visiting. Give directions, recommend places to see, and explain public transport.", opener: "Excuse me, how do I get to the train station?" },
];

export type TutorLevel = "easy" | "medium" | "hard";

export const LEVEL_GUIDE: Record<TutorLevel, string> = {
  easy: "Use very short, simple sentences (A1–A2), common words and present tense. Speak slowly and clearly.",
  medium: "Use natural everyday sentences (B1–B2) with some variety of tenses and common idioms explained if used.",
  hard: "Speak naturally and fluently (C1) with rich vocabulary, idioms and complex structures, as with a native speaker.",
};

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ParsedTutorReply {
  correction?: { original: string; corrected: string; explanation: string };
  alternatives: string[];
  reply: string;
}

const block = (text: string, tag: string) => {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`));
  return m ? m[1].trim() : null;
};
const field = (text: string, name: string) => {
  const m = text.match(new RegExp(`^\\s*${name}:\\s*(.+)$`, "mi"));
  return m ? m[1].trim() : "";
};

/**
 * Parse the tutor's tagged reply (works on partial streamed text too):
 *   <correction>original: …\ncorrected: …\nexplanation: …</correction>
 *   reply text…
 *   <alternatives>- …\n- …</alternatives>
 */
export function parseTutorReply(raw: string): ParsedTutorReply {
  const corr = block(raw, "correction");
  const alts = block(raw, "alternatives");
  const reply = raw
    .replace(/<correction>[\s\S]*?(<\/correction>|$)/, "")
    .replace(/<alternatives>[\s\S]*?(<\/alternatives>|$)/, "")
    .replace(/<\/?[a-z]*$/i, "") // hide a tag that is still streaming in
    .trim();
  const correction = corr ? { original: field(corr, "original"), corrected: field(corr, "corrected"), explanation: field(corr, "explanation") } : undefined;
  return {
    correction: correction && correction.corrected ? correction : undefined,
    alternatives: alts
      ? alts
          .split("\n")
          .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
          .filter(Boolean)
      : [],
    reply,
  };
}
