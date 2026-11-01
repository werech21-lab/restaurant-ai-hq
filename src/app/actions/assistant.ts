"use server";

import { answerQuestion } from "@/services/assistant.service";

export async function askAssistant(question: string) {
  return answerQuestion(question);
}
