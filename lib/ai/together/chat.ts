import Together from "together-ai";

export const askLlamaVision = async (together: Together, query: string, fileBase64: string) => {
  const response = await together.chat.completions.create({
    model: 'meta-llama/Llama-Vision-Free',
    messages: [
      {
        role: "user",
        // @ts-expect-error
        content: [
          {
            "type": "text",
            "text": query
          },
          {
            "type": "image_url",
            "image_url": {
              "url": `data:image/jpeg;base64,${fileBase64}`
            }
          }
        ]
      }
    ],
  });
  const message = response.choices[0].message;
  if (!message) {
    console.error("cannot get message from llama vision:", response);
    return "";
  }
  const content = message.content;
  if (!content) {
    console.error("cannot get message content from llama vision:", response);
    return ""
  }
  return content;
}
