export function extractArticleNumber(input: string): string {
  // Step 1: Parse content between "Article" and "Code"
  const match = input.match(/Article\s+(.*?)\s+Code/);
  if (!match)
    throw new Error("Article number not found in the string");
  let articleNumber = match[1];
  if (!articleNumber)
    throw new Error("Article number not found in the string");

  // Step 2: Remove spaces
  articleNumber = articleNumber.replace(/\s+/g, '');

  // Step 3: Remove non-allowed characters like "."
  articleNumber = articleNumber.replace(/[.]/g, '');

  return articleNumber.trim();
}

export function extractArticleSource(input: string): string {
  // Step 1: Parse content from "Code" to the rest of the string
  const match = input.match(/Code\s+(.*)$/);
  if (!match) {
    throw new Error("Article source not found in the string");
  }
  let articleSource = match[0].trim();

  // Step 2: Remove non-letter characters (excluding spaces)
  articleSource = articleSource.replace(/[^\p{L}\s]/gu, '');

  // Step 3: Ensure "Code" remains properly formatted, rest of the string is in lowercase
  articleSource = articleSource.charAt(0).toUpperCase() + articleSource.slice(1).toLowerCase();

  return articleSource.trim();
}

