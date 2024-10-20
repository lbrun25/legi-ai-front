import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getArticle} from "@/lib/supabase/searchArticles";

export const getArticleByNumber = tool(async (input) => {
  if (!input) return "";
  try {
    return getArticleByNumber2(input)
  } catch (error) {
    console.error(`could not get article: ${error}`);
    return "";
  }
}, {
  name: 'getArticleByNumber',
  description: "Obtient le contenu d'un article simplement avec sa source et son numéro",
  schema: z.object({
    source: z.string().describe("La source à laquelle l'article appartient. Exemple: Code civil"),
    number: z.string().describe("Le numéro de l'article")
  })
})

async function extractSource(input: string): Promise<string> {
  const regex = /source:\s*["']([^"']+)["']/;
  const match = input.match(regex);

  if (match) {
      return match[1]; // Retourne le texte extrait entre les guillemets simples ou doubles
  } else {
      throw new Error("No 'source' found in the input string");
  }
}


async function extractNumber(input: string): Promise<string> {
  const regex = /number:\s*["']([^"']+)["']/;
  const match = input.match(regex);

  if (match) {
      return match[1]; // Retourne le texte extrait entre les guillemets simples ou doubles
  } else {
      throw new Error("No 'number' found in the input string");
  }
}


export async function getArticleByNumber2(input: any) 
{
  console.log('[getArticleByNumber2] :', input)
  if (!input)
    return "";
  try {
    const source = await extractSource(input)
    console.log('source :', source)
    const number = await extractNumber(input)
    console.log('number :', number)
    const articleSource = source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
    const articleResponse = await getArticle(articleSource, number);
    return `<${articleSource}><article><number> ${articleResponse.number}</number><content>${articleResponse.content}</content><article></${articleSource}>`;
  } catch (error) {
    console.error(`could not get article: ${error}`);
    return "";
  }
}
