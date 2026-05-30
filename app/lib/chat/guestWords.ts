/**
 * Curated, age-stratified word / sentence / instruction pools for the speech
 * and comprehension stages.
 *
 * This is a client-side MIRROR of the fallback pools in the server route
 * app/api/chat/generate-words/route.ts. The FOSS / static-export build has no
 * server route, so it imports pickFallback() directly on the client to produce
 * the same offline content the server returns when Bedrock is unavailable.
 *
 * NOTE: the data here is intentionally kept byte-identical to the route's
 * embedded copy. The route is deliberately left untouched (zero prod risk); if
 * either copy changes, update both. Only used when IS_FOSS_BUILD.
 */

export type WordMode = "words" | "sentences" | "instructions";

export interface GeneratedItem {
  text: string;
  emoji: string;
}

export const WORD_EMOJIS: Record<string, string> = {
  mama: "👩", dada: "👨", ball: "⚽", dog: "🐶", cat: "🐱", milk: "🥛",
  more: "➕", up: "⬆️", bye: "👋", hi: "🙋", book: "📖", shoe: "👟",
  hat: "🎩", cup: "🥤", fish: "🐟", duck: "🦆", apple: "🍎", baby: "👶",
  car: "🚗", bird: "🐦", banana: "🍌", elephant: "🐘", butterfly: "🦋",
  dinosaur: "🦕", rainbow: "🌈", chocolate: "🍫", hello: "👋", purple: "🟣",
  circle: "⭕", triangle: "🔺", giraffe: "🦒", penguin: "🐧", rocket: "🚀",
  princess: "👸", monster: "👹", umbrella: "☂️", pumpkin: "🎃",
  strawberry: "🍓", airplane: "✈️", crocodile: "🐊", computer: "💻",
  adventure: "🗺️", incredible: "🌟", beautiful: "🌸", discovery: "🔍",
  astronaut: "🧑‍🚀", magnificent: "✨", helicopter: "🚁", wonderful: "💫",
  caterpillar: "🐛", watermelon: "🍉", constellation: "⭐", basketball: "🏀",
  trampoline: "🤸", hippopotamus: "🦛", refrigerator: "🧊", thermometer: "🌡️",
  xylophone: "🎵", vocabulary: "📝", harmonica: "🎶",
};

export const FALLBACK_WORDS: Record<string, string[]> = {
  young: ["mama", "dada", "ball", "dog", "cat", "milk", "more", "up", "bye", "hi",
          "book", "shoe", "hat", "cup", "fish", "duck", "apple", "baby", "car", "bird"],
  mid:   ["banana", "elephant", "butterfly", "dinosaur", "rainbow", "chocolate", "hello",
          "purple", "circle", "triangle", "giraffe", "penguin", "rocket", "princess",
          "monster", "umbrella", "pumpkin", "strawberry", "airplane", "crocodile"],
  old:   ["computer", "adventure", "incredible", "beautiful", "discovery", "astronaut",
          "magnificent", "helicopter", "wonderful", "caterpillar", "watermelon",
          "constellation", "basketball", "trampoline", "hippopotamus", "refrigerator",
          "thermometer", "xylophone", "vocabulary", "harmonica"],
};

export const FALLBACK_SENTENCES: Record<string, GeneratedItem[]> = {
  young: [
    { text: "The cat is big", emoji: "🐱" },
    { text: "I like dogs", emoji: "🐶" },
    { text: "My ball is red", emoji: "⚽" },
    { text: "I see a bird", emoji: "🐦" },
    { text: "The sun is hot", emoji: "☀️" },
    { text: "I want milk", emoji: "🥛" },
  ],
  mid: [
    { text: "The butterfly is very pretty", emoji: "🦋" },
    { text: "I want to go outside and play", emoji: "🏃" },
    { text: "My favorite color is blue", emoji: "🔵" },
    { text: "The dog is running in the park", emoji: "🐶" },
    { text: "I can count to ten", emoji: "🔢" },
    { text: "The moon comes out at night", emoji: "🌙" },
  ],
  old: [
    { text: "The elephant walked through the tall jungle", emoji: "🐘" },
    { text: "Can you tell me about your favorite game", emoji: "🎮" },
    { text: "The beautiful rainbow appeared after the rain", emoji: "🌈" },
    { text: "I like to read books before bedtime", emoji: "📚" },
    { text: "The spaceship flew high into the sky", emoji: "🚀" },
    { text: "My friend and I played at the park today", emoji: "🏞️" },
  ],
};

export const FALLBACK_INSTRUCTIONS: Record<string, GeneratedItem[]> = {
  young: [
    { text: "Clap your hands", emoji: "👏" },
    { text: "Wave bye bye", emoji: "👋" },
    { text: "Say your name", emoji: "🗣️" },
    { text: "Touch your nose", emoji: "👃" },
    { text: "Say mama", emoji: "👩" },
  ],
  mid: [
    { text: "Clap your hands two times", emoji: "👏" },
    { text: "Say hello and then wave", emoji: "👋" },
    { text: "Count to three out loud", emoji: "🔢" },
    { text: "Tell me something that is red", emoji: "🔴" },
    { text: "Say the word butterfly", emoji: "🦋" },
  ],
  old: [
    { text: "Clap your hands then touch your head", emoji: "👏" },
    { text: "Say your name and how old you are", emoji: "🗣️" },
    { text: "Count backwards from five", emoji: "🔢" },
    { text: "Tell me your favorite animal and why", emoji: "🐾" },
    { text: "Say a long word like hippopotamus", emoji: "🦛" },
  ],
};

export function getAgeBracket(ageMonths: number): string {
  if (ageMonths < 36) return "young";
  if (ageMonths < 60) return "mid";
  return "old";
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickFallbackWords(ageMonths: number, count: number): GeneratedItem[] {
  const bracket = getAgeBracket(ageMonths);
  const pool = FALLBACK_WORDS[bracket];
  return shuffle(pool).slice(0, count).map((w) => ({
    text: w,
    emoji: WORD_EMOJIS[w] || "🔤",
  }));
}

export function pickFallbackSentences(ageMonths: number, count: number): GeneratedItem[] {
  const bracket = getAgeBracket(ageMonths);
  return shuffle(FALLBACK_SENTENCES[bracket]).slice(0, count);
}

export function pickFallbackInstructions(ageMonths: number, count: number): GeneratedItem[] {
  const bracket = getAgeBracket(ageMonths);
  return shuffle(FALLBACK_INSTRUCTIONS[bracket]).slice(0, count);
}

export function pickFallback(mode: WordMode, ageMonths: number, count: number): GeneratedItem[] {
  switch (mode) {
    case "words": return pickFallbackWords(ageMonths, count);
    case "sentences": return pickFallbackSentences(ageMonths, count);
    case "instructions": return pickFallbackInstructions(ageMonths, count);
  }
}
