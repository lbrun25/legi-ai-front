import OpenAI from "openai";
import {AnswerSuggestionsSystem} from "@/lib/constants/assistant";
import {DOMParser} from '@xmldom/xmldom'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// Get suggestions based on the answer
export async function POST(req: Request) {
  try {
    const input: {
      answer: string;
    } = await req.json();
    const completion = await openai.chat.completions.create({
      messages: [
        {"role": "system", "content": AnswerSuggestionsSystem},
        {"role": "user", "content": input.answer}
      ],
      model: "gpt-4o-mini",
    });
    let suggestionsText = completion.choices[0].message.content;
    if (!suggestionsText) return new Response(null, {status: 404});

    // Remove formatting markers if present
    suggestionsText = suggestionsText.replace(/```xml/g, '').replace(/```/g, '');

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(suggestionsText, "application/xml");
    const suggestionNodes = xmlDoc.getElementsByTagName("suggestion");

    const suggestionsArray = Array.from(suggestionNodes)
      .map((node) => node.textContent?.trim())
      .filter((text) => text !== undefined && text !== "");

    console.log('suggestionsArray:', suggestionsArray);

    return new Response(JSON.stringify(suggestionsArray), {status: 200});
  } catch (error) {
    return new Response(null, {status: 500})
  }
}
