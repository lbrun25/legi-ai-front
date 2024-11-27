import {UnstructuredTableElement} from "@/lib/types/table";
import OpenAI from "openai";
import {PromptTemplate} from "@langchain/core/prompts";
import {SummarizeTableRow} from "@/lib/ai/langgraph/prompt";
import {NextResponse} from "next/server";
import { JSDOM } from "jsdom";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const makeTableRowChunkAsHTML = async (
  row: Element,
  columnHeaders: string[],
  tableHeader: string,
  summary: string
): Promise<string> => {
  const rowHTML = row.outerHTML.trim();
  return `
    ${summary}
    <table>
      <caption>${tableHeader}</caption>
      <thead>
        <tr>${columnHeaders.map(header => `<th>${header}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rowHTML}
      </tbody>
    </table>
  `.trim();
};

const makeTableChunksAsHTML = async (tableHtml: string): Promise<string[]> => {
  const dom = new JSDOM(tableHtml);
  const doc = dom.window.document;

  // Extract table header (caption) and column headers
  const tableHeader = doc.querySelector("caption")?.textContent?.trim() || "No table header available";
  const columnHeaders = Array.from(doc.querySelectorAll("thead th")).map(th => th.textContent?.trim() || "");

  // Extract rows from tbody
  const rows = Array.from(doc.querySelectorAll("tbody tr"));

  // Process each row using Promise.allSettled
  const results = await Promise.allSettled(
    rows.map(async (row) => {
      const rowText = row.textContent?.trim() || "No content in row";

      try {
        // Create the prompt for summarization
        const prompt = new PromptTemplate({
          template: SummarizeTableRow,
          inputVariables: ['TABLE', 'ROW'],
        });

        const formattedPrompt = await prompt.format({
          TABLE: tableHtml,
          ROW: rowText,
        });

        // Call OpenAI API for summarization
        const chatCompletion = await openai.chat.completions.create({
          messages: [{ role: "user", content: formattedPrompt }],
          model: "gpt-4o-mini",
        });

        const summary = chatCompletion.choices[0]?.message?.content?.trim() || "Summary not generated.";
        if (!summary) {
          throw new Error("Failed to generate summary.");
        }
        return await makeTableRowChunkAsHTML(row, columnHeaders, tableHeader, summary);
      } catch (error) {
        console.error("Error processing row:", rowText, error);
        return null; // Return null for failed rows
      }
    })
  );
  return results
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled" && result.value !== null)
    .map(result => result.value);
};

export async function POST(req: Request) {
  // Parse the request body
  const input: {
    table: UnstructuredTableElement;
  } = await req.json();

  try {
    console.log('table:', input.table);
    const chunks = await makeTableChunksAsHTML(input.table.html);
    console.log('table chunks:', chunks);
    return new Response(JSON.stringify({ chunks }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error("cannot make table chunks:", error);
    return NextResponse.json({ message: 'Failed to make table chunks' }, { status: 500 });
  }
}
