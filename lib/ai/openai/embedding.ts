"use server"

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export const createOpenAiEmbedding = async (input: string) => {
  const result = await openai.embeddings.create({
    input: input,
    model: "text-embedding-3-large",
  });
  const [{embedding}] = result.data;
  return embedding;
}
