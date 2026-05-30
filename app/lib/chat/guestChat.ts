/**
 * Client-side fallback conversation for the FOSS build.
 *
 * The default build calls /api/chat/conversation (Amazon Nova via Bedrock),
 * which itself falls back to a scripted conversation when AWS is unavailable.
 * The FOSS / static-export build has no server route, so this module reproduces
 * that scripted conversation entirely on the client. It mirrors the pools in
 * app/api/chat/conversation/route.ts (buildFallbackTurn) so the offline
 * experience matches the server's degraded mode. Only used when IS_FOSS_BUILD.
 */

const PERSONALITY_PREFIX: Record<string, string> = {
  dog: "Woof! ",
  cat: "Purrr... ",
  rabbit: "Oh! ",
  parrot: "Squawk! ",
};

/** Returns the next scripted conversation turn for a guest (offline) chat. */
export function guestChatTurn(
  childName: string,
  turnNumber: number,
  animalPersonality?: string,
): { text: string; shouldEnd: boolean } {
  const prefix = (animalPersonality && PERSONALITY_PREFIX[animalPersonality]) || "";

  const greetings = [
    `${prefix}Hi ${childName}! I'm so happy to see you! What have you been up to today?`,
    `${prefix}Hello ${childName}! I've been looking forward to chatting with you! How are you doing?`,
    `${prefix}Hey ${childName}! It's so nice to talk with you! What's something fun that happened today?`,
  ];

  const midQuestions = [
    `${prefix}That's cool! So tell me, what's your favorite thing to play with?`,
    `${prefix}Ooh, I love that! If you could have any superpower, what would it be?`,
    `${prefix}That sounds amazing! Do you have a favorite cartoon or story?`,
    `${prefix}So fun! If we could go on an adventure anywhere, where would you want to go?`,
    `${prefix}I love talking with you! What makes you really, really happy?`,
    `${prefix}That's awesome! What's your favorite yummy snack?`,
    `${prefix}Yum! If you could be any animal in the whole world, which one would you pick?`,
    `${prefix}Great choice! Do you have a best friend? What do you like to do together?`,
    `${prefix}That sounds like so much fun! What's the silliest thing that ever happened to you?`,
    `${prefix}Ha! That's funny! What do you want to be when you grow up?`,
  ];

  const farewell = `${prefix}You did such an amazing job, ${childName}! Thank you so much for talking with me today! You're wonderful!`;

  if (turnNumber === 0) {
    return { text: greetings[Math.floor(Math.random() * greetings.length)], shouldEnd: false };
  }
  if (turnNumber >= 6) {
    return { text: farewell, shouldEnd: true };
  }
  const poolIdx = (turnNumber - 1) % midQuestions.length;
  return { text: midQuestions[poolIdx], shouldEnd: false };
}
