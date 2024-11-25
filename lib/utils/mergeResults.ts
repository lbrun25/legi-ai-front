export async function mergeResults(results: any) {
    const mergedResults: any[] = [];
    const map = new Map();

    results.forEach((result: any) => {
        if (typeof result === 'string') {
            mergedResults.push(result);
        } else {
            const { codeName, listIDs } = result; // Correction ici
            if (!map.has(codeName)) {
                map.set(codeName, new Set(listIDs));
            } else {
                const existingSet = map.get(codeName);
                listIDs.forEach((id: any) => existingSet.add(id));
            }
        }
    });

    map.forEach((listIDs, codeName) => {
        mergedResults.push({
            codeName,
            listIDs: Array.from(listIDs),
        });
    });

    return mergedResults;
}
