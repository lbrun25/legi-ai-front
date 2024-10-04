import {RankFusionResult, ScoredRankFusionItem} from "@/lib/types/rank-fusion";

// Initial scoring with weights
function calculateWeightedScores(
  combinedIds: Set<bigint>,
  semanticIds: bigint[],
  bm25Ids: bigint[],
  semanticWeight: number,
  bm25Weight: number
): Map<bigint, number> {
  const idToScore: Map<bigint, number> = new Map();

  combinedIds.forEach(id => {
    let score = 0;
    if (semanticIds.includes(id)) {
      const index = semanticIds.indexOf(id);
      score += semanticWeight * (1 / (index + 1)); // Weighted score for semantic results
    }
    if (bm25Ids.includes(id)) {
      const index = bm25Ids.indexOf(id);
      score += bm25Weight * (1 / (index + 1)); // Weighted score for BM25 results
    }
    idToScore.set(id, score);
  });

  return idToScore;
}

// Helper function to sort IDs by score
function sortByScore(idToScore: Map<bigint, number>): bigint[] {
  return Array.from(idToScore.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by score in descending order
    .map(([id]) => id);
}

function printResults(totalResults: number, semanticCount: number, bm25Count: number) {
  // Calculate semantic and BM25 percentages
  const semanticPercentage = totalResults > 0 ? (semanticCount / totalResults) * 100 : 0;
  const bm25Percentage = totalResults > 0 ? (bm25Count / totalResults) * 100 : 0;

  // Log the percentages
  console.log(`Semantic Percentage: ${semanticPercentage}%`);
  console.log(`BM25 Percentage: ${bm25Percentage}%`);
}

export function rankFusion(
  semanticIds: bigint[],
  bm25Ids: bigint[],
  k: number,
  semanticWeight: number,
  bm25Weight: number
): RankFusionResult {
  const combinedIds: Set<bigint> = new Set([...semanticIds, ...bm25Ids]);
  const idToScore = calculateWeightedScores(combinedIds, semanticIds, bm25Ids, semanticWeight, bm25Weight);
  const sortedIds = sortByScore(idToScore);

  // Assign new scores based on sorted order
  sortedIds.forEach((id, index) => {
    idToScore.set(id, 1 / (index + 1));
  });

  const allResults: ScoredRankFusionItem[] = [];
  const seenIds: Set<number> = new Set();  // Set to track seen ids as numbers
  let semanticCount = 0;
  let bm25Count = 0;

  // Process all IDs and remove duplicates
  sortedIds.forEach(id => {
    const idNumber: any = Number(id);  // Convert id to a number

    // Skip if we've already seen this ID
    if (seenIds.has(idNumber)) {
      return;
    }
    seenIds.add(idNumber);  // Add the id to the seen set

    const isFromSemantic = semanticIds.includes(id);
    const isFromBM25 = bm25Ids.includes(id);

    allResults.push({
      id: idNumber,  // Ensure id is returned as a number
      score: idToScore.get(id) || 0,
      fromSemantic: isFromSemantic,
      fromBM25: isFromBM25,
    });

    if (isFromSemantic && !isFromBM25) {
      semanticCount += 1;
    } else if (isFromBM25 && !isFromSemantic) {
      bm25Count += 1;
    } else {
      // It's in both
      semanticCount += 0.5;
      bm25Count += 0.5;
    }
  });

  // Now apply slice after deduplication to get exactly 'k' unique decisions
  const finalResults = allResults.slice(0, k);

  printResults(finalResults.length, semanticCount, bm25Count);

  return { results: finalResults, semanticCount, bm25Count };
}

