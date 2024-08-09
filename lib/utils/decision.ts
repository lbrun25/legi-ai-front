export function extractDecisionNumber(input: string): string {
  // Step 1: Match the part from "n°" to the decision number, handling both cases with or without a prefix
  const match = input.match(/n°\s*(?:\w+\s+)?([\d./-]+)/);
  if (!match) {
    throw new Error("Decision number not found in the string");
  }

  // Step 2: Return the decision number prefixed with "n°"
  const decisionNumber = match[1];
  return `n°${decisionNumber}`;
}
