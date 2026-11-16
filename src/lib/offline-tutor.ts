/**
 * Offline practice tutor (no API key needed).
 * A rule-based English conversation partner: scripted scenario dialogues plus
 * pattern-based checks for common beginner grammar mistakes. It replies in the
 * same tagged format as the AI tutor, so the chat UI renders both identically.
 * It is intentionally modest – it catches frequent errors, not every error.
 */
import type { TutorMessage } from "./tutor";

export interface GrammarIssue {
  original: string;
  corrected: string;
  explanation: string;
}

type Rule = { re: RegExp; fix: (m: RegExpMatchArray) => string; why: string };

const THIRD_PERSON: Record<string, string> = {
  go: "goes", do: "does", have: "has", like: "likes", want: "wants", work: "works", live: "lives", play: "plays",
  eat: "eats", drink: "drinks", speak: "speaks", read: "reads", watch: "watches", study: "studies", need: "needs",
  love: "loves", come: "comes", make: "makes", know: "knows", get: "gets", take: "takes", say: "says", walk: "walks",
};
const BASE = Object.fromEntries(Object.entries(THIRD_PERSON).map(([b, s]) => [s, b]));
const keepCase = (src: string, out: string) => (src[0] === src[0].toUpperCase() ? out[0].toUpperCase() + out.slice(1) : out);
const AN_EXCEPTIONS = /^(uni|use|usu|eu|one|once)/i;

const RULES: Rule[] = [
  { re: /\bI have (\d+|[a-z-]+) years?( old)?\b/i, fix: (m) => `I am ${m[1]} years old`, why: "In English we use 'be' for age: I am 25 years old (not 'I have 25 years')." },
  { re: /\bI am agree\b/i, fix: () => "I agree", why: "'Agree' is a verb, so we say 'I agree' without 'am'." },
  { re: /\b(he|she|it|this|that) (are|am)\b/i, fix: (m) => `${m[1]} is`, why: "Use 'is' with he, she, it and one person or thing." },
  { re: /\bI (is|are)\b/, fix: () => "I am", why: "With 'I', the verb 'be' is always 'am'." },
  { re: /\b(you|we|they) (is|am)\b/i, fix: (m) => `${m[1]} are`, why: "Use 'are' with you, we and they." },
  { re: /\b(people|children) is\b/i, fix: (m) => `${m[1]} are`, why: "'People' and 'children' are plural, so use 'are'." },
  {
    // Not after helpers ("Does he like…", "can she go") – those take the base verb.
    re: new RegExp(`(?<!\\b(?:does|did|doesn't|didn't|can|can't|will|won't|would|should|must|let|to|make|made)\\s)\\b(he|she|it|my (?:mother|father|sister|brother|friend)) (${Object.keys(THIRD_PERSON).join("|")})\\b`, "i"),
    fix: (m) => `${m[1]} ${THIRD_PERSON[m[2].toLowerCase()]}`,
    why: "In the present simple, add -s to the verb after he, she or it (he goes, she likes, it has).",
  },
  {
    re: new RegExp(`\\b(does|doesn't|did|didn't|do|don't|can|can't|will|won't) (\\w+ )?(${Object.keys(BASE).join("|")})\\b`, "i"),
    fix: (m) => `${m[1]} ${m[2] ?? ""}${BASE[m[3].toLowerCase()]}`,
    why: "After do/does/did, can or will, use the base form of the verb (Does she like…? not 'likes').",
  },
  { re: /\b(I|you|we|they) (goes|has|does|likes|wants|works|lives|plays|speaks|needs|loves)\b/i, fix: (m) => `${m[1]} ${BASE[m[2].toLowerCase()]}`, why: "With I, you, we and they, the verb has no -s (I like, they work)." },
  { re: /\bcan to (\w+)/i, fix: (m) => `can ${m[1]}`, why: "After 'can', use the verb directly: I can swim (not 'can to swim')." },
  { re: /\bwant (go|eat|drink|buy|see|visit|learn|play|watch|meet)\b/i, fix: (m) => `want to ${m[1]}`, why: "'Want' needs 'to' before another verb: I want to go." },
  { re: /\bdidn't (went|ate|saw|bought|came|had|did|made|took)\b/i, fix: (m) => `didn't ${({ went: "go", ate: "eat", saw: "see", bought: "buy", came: "come", had: "have", did: "do", made: "make", took: "take" } as Record<string, string>)[m[1].toLowerCase()]}`, why: "After 'didn't', use the base verb: I didn't go." },
  { re: /\bwhere you are from\b/i, fix: () => "where are you from", why: "In questions, the verb comes before the subject: Where are you from?" },
  { re: /\bwhat (your|his|her) name\b/i, fix: (m) => `what is ${m[1]} name`, why: "Questions need a verb: What is your name?" },
  { re: /\bhow old you are\b/i, fix: () => "how old are you", why: "In questions, put 'are' before 'you': How old are you?" },
  { re: /\bI very (like|love|want|enjoy)\b/i, fix: (m) => `I really ${m[1]}`, why: "'Very' can't go before a verb. Use 'really': I really like it (or 'I like it very much')." },
  { re: /\ba ([aeiou]\w*)/i, fix: (m) => (AN_EXCEPTIONS.test(m[1]) ? m[0] : `an ${m[1]}`), why: "Use 'an' before a vowel sound: an apple, an orange, an hour." },
  { re: /\ban ([bcdfgjklmnpqrstvwxyz]\w*)/i, fix: (m) => (/^(hour|honest|honou?r)/i.test(m[1]) ? m[0] : `a ${m[1]}`), why: "Use 'a' before a consonant sound: a book, a car, a university." },
  { re: /\bgo to (the )?home\b/i, fix: () => "go home", why: "We say 'go home' – no 'to' or 'the' before 'home'." },
  { re: /\bmore (better|bigger|smaller|easier|cheaper)\b/i, fix: (m) => m[1], why: "'Better', 'bigger' etc. are already comparatives, so don't add 'more'." },
  { re: /\bin (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i, fix: (m) => `on ${m[1][0].toUpperCase()}${m[1].slice(1)}`, why: "Use 'on' with days: on Monday." },
  { re: /\bon (\d{1,2}(:\d{2})? ?(am|pm|o'clock))/i, fix: (m) => `at ${m[1]}`, why: "Use 'at' with clock times: at 7 o'clock." },
];

/** Find the first likely grammar mistake in a learner sentence. */
export function checkGrammar(text: string): GrammarIssue | null {
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    for (const rule of RULES) {
      const m = sentence.match(rule.re);
      if (!m) continue;
      const replacement = rule.fix(m);
      if (replacement.toLowerCase() === m[0].toLowerCase()) continue;
      let corrected = sentence.replace(m[0], keepCase(m[0], replacement)).trim();
      corrected = corrected[0].toUpperCase() + corrected.slice(1);
      if (/^(where|what|how|do|does|can|are|is)\b/i.test(corrected) && !/[?]$/.test(corrected)) corrected = corrected.replace(/[.!]?$/, "?");
      return { original: sentence.trim(), corrected, explanation: rule.why };
    }
  }
  return null;
}

/** All issues in a longer text (used by offline writing feedback). */
export function checkAllGrammar(text: string): GrammarIssue[] {
  const out: GrammarIssue[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/).filter((s) => s.trim())) {
    let current = sentence;
    for (let i = 0; i < 4; i++) {
      const issue = checkGrammar(current);
      if (!issue) break;
      out.push({ ...issue, original: current.trim() });
      current = issue.corrected;
    }
  }
  return out.slice(0, 6);
}

// ── Scenario scripts ─────────────────────────────────────────

interface Reaction {
  re: RegExp;
  say: string;
}
interface Script {
  greeting: string;
  steps: string[];
  reactions: Reaction[];
  closing: string;
}

const SCRIPTS: Record<string, Script> = {
  free: {
    greeting: "Hi! I'm Lumi. How are you today?",
    steps: ["What is your name?", "Where are you from?", "What do you do – are you a student or do you work?", "What do you like to do in your free time?", "What is your favourite food?", "What did you do yesterday?", "What are your plans for the weekend?"],
    reactions: [
      { re: /\b(fine|good|great|ok|okay|happy)\b/i, say: "I'm glad to hear that!" },
      { re: /\b(tired|sad|bad|sick)\b/i, say: "Oh no, I hope you feel better soon." },
      { re: /\bmy name is (\w+)|\bi'?m (\w+)\b/i, say: "Nice to meet you!" },
      { re: /\b(india|chennai|bangalore|kerala|delhi|mumbai|hyderabad|tamil nadu|france|spain|japan|korea|germany)\b/i, say: "Oh, that's a beautiful place!" },
      { re: /\b(student|study|school|college|university)\b/i, say: "Studying is great!" },
      { re: /\b(football|cricket|music|read|movies?|films?|games?|cook|dance|travel)\b/i, say: "That sounds fun!" },
    ],
    closing: "You did really well today! Do you want to talk about anything else?",
  },
  food: {
    greeting: "Good afternoon, welcome to Lumi Café! Here is the menu. We have coffee, tea, sandwiches, soup and chocolate cake. What would you like to drink?",
    steps: ["Great choice. Would you like something to eat as well?", "Would you like it hot or cold?", "Anything else? Maybe a piece of cake?", "Is that for here or to take away?", "Here you are. Enjoy your meal! Is everything okay?", "Would you like the bill?"],
    reactions: [
      { re: /\b(coffee|tea|water|juice)\b/i, say: "One $1, no problem." },
      { re: /\b(sandwich|soup|cake|salad)\b/i, say: "The $1 is very good today." },
      { re: /\bhow much\b/i, say: "Coffee and tea are 3 dollars, sandwiches are 6 dollars and cake is 4 dollars." },
      { re: /\b(bill|check|pay)\b/i, say: "Of course. That's 9 dollars, please." },
      { re: /\bplease\b/i, say: "Thank you for being so polite!" },
    ],
    closing: "Thank you for visiting Lumi Café. Have a lovely day! Would you like to order again?",
  },
  airport: {
    greeting: "Good morning! Welcome to check-in. Can I see your passport, please?",
    steps: ["Thank you. Where are you flying to today?", "How many bags are you checking in?", "Would you like a window seat or an aisle seat?", "Did you pack your bags yourself?", "Here is your boarding pass. Your gate is B12 and boarding starts at 10:30. Do you have any questions?"],
    reactions: [
      { re: /\b(here|passport)\b/i, say: "Thank you." },
      { re: /\b(london|paris|dubai|singapore|new york|tokyo|delhi|chennai|mumbai|bangalore)\b/i, say: "$1 – lovely!" },
      { re: /\b(one|two|1|2) (bag|suitcase)/i, say: "Okay, please put it on the scale." },
      { re: /\bwindow\b/i, say: "A window seat – great for the view." },
      { re: /\baisle\b/i, say: "An aisle seat – easy to move around." },
      { re: /\bwhere is (the )?gate\b/i, say: "Gate B12 is up the stairs and to the left." },
    ],
    closing: "Have a safe flight! Is there anything else I can help you with?",
  },
  interview: {
    greeting: "Good morning, thank you for coming. Please, have a seat. Can you tell me a little about yourself?",
    steps: ["Thank you. What job are you applying for?", "What experience do you have?", "What are your strengths?", "What is one weakness you are working on?", "Why do you want to work here?", "Where do you see yourself in five years?", "Do you have any questions for me?"],
    reactions: [
      { re: /\b(team|teamwork|communicat|organi[sz]ed|hard-?working|creative|leader)/i, say: "That's an important skill." },
      { re: /\b(\d+) years?\b/i, say: "That's good experience." },
      { re: /\b(developer|engineer|teacher|designer|manager|nurse|accountant|sales)\b/i, say: "Great – we need a good $1." },
    ],
    closing: "Thank you very much. We will contact you next week. Good luck! Would you like to practise another question?",
  },
  shopping: {
    greeting: "Hello! Welcome to our shop. Can I help you find something?",
    steps: ["What size are you?", "What colour would you like?", "Would you like to try it on? The fitting room is over there.", "How does it fit?", "Would you like to pay by card or cash?"],
    reactions: [
      { re: /\b(shirt|t-?shirt|dress|jeans|shoes|jacket|bag)\b/i, say: "We have some nice $1s over here." },
      { re: /\b(small|medium|large|s|m|l|xl)\b/i, say: "Let me check… yes, we have that size." },
      { re: /\b(red|blue|green|black|white|yellow|pink|grey)\b/i, say: "$1 looks great!" },
      { re: /\bhow much\b/i, say: "This one is 25 dollars. It's on sale today." },
      { re: /\b(too expensive|cheaper)\b/i, say: "This one is cheaper – only 15 dollars." },
    ],
    closing: "Here's your receipt. Thank you for shopping with us! Anything else today?",
  },
  meeting: {
    greeting: "Hi! I don't think we've met. I'm Lumi. What's your name?",
    steps: ["Nice to meet you! Where are you from?", "How do you know the host of the party?", "What do you do?", "Do you have any hobbies?", "Have you tried the food? It's delicious.", "It was great to meet you! Can I have your number to stay in touch?"],
    reactions: [
      { re: /\bmy name is (\w+)|\bi'?m (\w+)/i, say: "Great to meet you!" },
      { re: /\b(friend|colleague|neighbou?r|cousin|brother|sister)\b/i, say: "Oh, nice!" },
      { re: /\b(football|cricket|music|reading|movies?|games?|cooking|dancing|travel)/i, say: "Me too! I love that." },
    ],
    closing: "See you soon! Would you like to keep chatting?",
  },
  university: {
    greeting: "Hi! Is this your first day too? I'm Lumi. What are you studying?",
    steps: ["Cool! Which year are you in?", "Do you know where the library is?", "What time is your first class?", "Do you want to have lunch together after class?", "Have you joined any clubs?"],
    reactions: [
      { re: /\b(computer|engineering|math|science|business|art|medicine|law|english|history)\b/i, say: "That's a great subject!" },
      { re: /\b(first|second|third|1st|2nd|3rd)\b/i, say: "Nice, me too!" },
      { re: /\bwhere is\b/i, say: "It's next to the main building, opposite the café." },
    ],
    closing: "See you in class! Want to talk about anything else?",
  },
  travel: {
    greeting: "Hello! You look a little lost. Can I help you?",
    steps: ["Where do you want to go?", "You can take the bus or walk. Which do you prefer?", "Is this your first time in the city?", "Have you visited the museum yet? It's very famous.", "How long are you staying here?"],
    reactions: [
      { re: /\b(station|museum|hotel|beach|airport|market|bank|hospital)\b/i, say: "The $1? Go straight on, then turn left at the bank. It's about ten minutes away." },
      { re: /\bbus\b/i, say: "Take bus number 7 – the stop is just across the road." },
      { re: /\bwalk\b/i, say: "Walking is nice – it's a sunny day." },
      { re: /\bhow (far|long)\b/i, say: "It's about ten minutes on foot." },
    ],
    closing: "Enjoy your trip! Do you need help with anything else?",
  },
};

const ENCOURAGE = ["Good job!", "Nice!", "Great answer.", "Well said!", "Thanks for telling me."];

function alternativesFor(text: string): string[] {
  const t = text.toLowerCase();
  if (/\b(i want|give me)\b/.test(t)) return ["I'd like …, please.", "Could I have …, please?"];
  if (/\bi'?m fine\b/.test(t)) return ["I'm doing well, thanks!", "Pretty good, thank you."];
  if (/\bthank/.test(t)) return ["Thanks a lot!", "Thank you so much!"];
  if (/\bmy name is\b/.test(t)) return ["I'm …", "You can call me …"];
  return [];
}

/** Produce the offline tutor's next reply, in the same tagged format as the AI tutor. */
export function offlineTutorReply(history: TutorMessage[], scenarioId: string): string {
  const script = SCRIPTS[scenarioId] ?? SCRIPTS.free;
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const userTurns = history.filter((m) => m.role === "user").length;
  const parts: string[] = [];

  // Apply every rule that matches (up to 3), so one message can get several fixes at once.
  let issue: GrammarIssue | null = null;
  let firstOriginal: string | null = null;
  const reasons: string[] = [];
  let working = last.trim();
  for (let i = 0; i < 3; i++) {
    const next = checkGrammar(working);
    if (!next) break;
    firstOriginal ??= next.original;
    issue = { original: firstOriginal, corrected: next.corrected, explanation: "" };
    if (!reasons.includes(next.explanation)) reasons.push(next.explanation);
    working = next.corrected;
  }
  if (issue) parts.push(`<correction>\noriginal: ${issue.original}\ncorrected: ${issue.corrected}\nexplanation: ${reasons.join(" ")}\n</correction>`);

  const reaction = script.reactions.find((r) => r.re.test(last));
  let reply = "";
  if (userTurns <= 1 && history.length <= 1) reply = script.greeting;
  else {
    if (reaction) {
      const m = last.match(reaction.re)!;
      const word = (m[1] ?? m[0]).toLowerCase();
      reply = reaction.say.replace("$1", word) + " ";
    } else if (!issue) {
      reply = ENCOURAGE[userTurns % ENCOURAGE.length] + " ";
    }
    const stepIdx = userTurns - 2;
    reply += stepIdx < script.steps.length ? script.steps[Math.max(0, stepIdx)] : script.closing;
  }
  parts.push(reply.trim());
  const alts = alternativesFor(last);
  if (alts.length) parts.push(`<alternatives>\n${alts.map((a) => `- ${a}`).join("\n")}\n</alternatives>`);
  return parts.join("\n");
}

/** Offline writing feedback with the same shape as the AI endpoint. */
export function offlineWritingFeedback(text: string) {
  const issues = checkAllGrammar(text).map((i) => ({ original: i.original, suggestion: i.corrected, explanation: i.explanation }));
  let corrected = text;
  for (const i of issues) corrected = corrected.replace(i.original, i.suggestion);
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 2);
  const words = text.split(/\s+/).filter(Boolean);
  const strengths: string[] = [];
  if (sentences.length >= 3) strengths.push(`You wrote ${sentences.length} sentences – a good length.`);
  if (new Set(words.map((w) => w.toLowerCase())).size >= 25) strengths.push("You used a nice variety of words.");
  if (/\b(and|but|because|so)\b/i.test(text)) strengths.push("You connected ideas with words like 'and', 'but' or 'because'.");
  if (!strengths.length) strengths.push("You finished the task – well done for practising!");
  const score = Math.max(30, Math.min(100, 95 - issues.length * 12 + Math.min(10, sentences.length * 2) - (sentences.length < 2 ? 15 : 0)));
  return {
    score,
    corrected,
    issues,
    strengths,
    encouragement: issues.length
      ? "Nice work! Fix these small points and read your text aloud once more."
      : "Great job – no common mistakes found. Try writing a longer text next time!",
  };
}
