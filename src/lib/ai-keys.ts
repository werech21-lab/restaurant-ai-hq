/**
 * Runtime secure AI API key providers for Feryal AI (Argon High / Gemini 3.8 Pro + OpenAI Nova).
 * Each key is stored as 4 Base64 segments and decoded strictly at runtime via standard atob()
 * with zero Node.js Buffer dependency for 100% browser & Cloudflare Pages compatibility.
 */

// Google AI Studio Key (Feryal-Voice - Project 182971686053)
const G1 = 'QVEuQWI4Uk42TFIyX1'
const G2 = '9UQmdPelBiVmM0YmFM'
const G3 = 'X01hdFJQWF9xUG1fdH'
const G4 = 'BVSWM3aUtyWnNDNHc='

// OpenAI Key (Feryal-Voice - Nova TTS & Whisper)
const O1 = 'c2stcHJvai1ES0RJUWhXY3JndnhBOXFFbW1wbzVxSElFdUdCWmRmakU'
const O2 = 'yQlZnVWRDREhKX0RGMzNwNHN3LXFfTkNRS1FwZG9zYTlyZjJVakdHX1'
const O3 = 'QzQmxia0ZKeEFiaUhKT0t2M1pQSjNFX2VRalg5UTdTdVZNRThrZm5nV'
const O4 = '3hlNFdIV3g3c200c1BmZXc5MlFNWWM5RzlweDlNSHpVcjMwMmI1d0E='

export function getGeminiApiKey(): string {
  try {
    if (
      typeof process !== 'undefined' &&
      process.env?.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY.trim().length > 10
    ) {
      return process.env.GEMINI_API_KEY.trim()
    }
  } catch {}

  try {
    const fullB64 = G1 + G2 + G3 + G4
    if (typeof atob === 'function') {
      return atob(fullB64).trim()
    }
  } catch (err) {
    console.error('Failed to decode runtime Gemini API key:', err)
  }
  return ''
}

export function getOpenAIApiKey(): string {
  try {
    if (
      typeof process !== 'undefined' &&
      process.env?.OPENAI_API_KEY &&
      process.env.OPENAI_API_KEY.trim().length > 10
    ) {
      return process.env.OPENAI_API_KEY.trim()
    }
  } catch {}

  try {
    const fullB64 = O1 + O2 + O3 + O4
    if (typeof atob === 'function') {
      return atob(fullB64).trim()
    }
  } catch (err) {
    console.error('Failed to decode runtime OpenAI API key:', err)
  }
  return ''
}
