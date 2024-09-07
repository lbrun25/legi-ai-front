export async function* streamingFetch(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, init)
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');

  for (; ;) {
    const {done, value} = await reader.read()
    if (done) break;
    try {
      yield decoder.decode(value)
    } catch (error) {
      console.error("cannot fetch stream:", error);
    }
  }
}
