import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {getArticle} from "@/lib/supabase/searchArticles";

export const getArticleByNumberTool = tool(async (input) => {
  try {
    // Validation de l'entrée
    if (!input) {
      throw new Error("La requête de recherche de articlebynumber ne peut pas être vide");
    }

    // Effectuer la recherche
    const article = await getArticleByNumber3(input);

    // Vérifier si la réponse est valide
    if (!article) {
      return "Aucun résultat trouvé un article avec à son number et code";
    }
    console.log(`[getArticleByNumber] Pour l'input : "article ${input.number} du ${input.source} ", l'article vient d'être transmise à l'agent.`);
    return article;
  } catch (error: any) {
    console.error("Erreur lors de la recherche du contenu d'un article grace à son number et code :", error);
    throw new Error(`Erreur lors de la recherche du contenu d'un article grace à son number et code : ${error.message}`);
  }
},
{
  name: 'getArticleByNumber',
  description: "Obtient le contenu d'un article simplement avec sa source et son numéro",
  schema: z.object({
    source: z.string().describe("La nom du code auquel appartient l'article. Exemple: Code civil"),
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

export async function getArticleByNumber3(input: any) 
{
  //console.log('[getArticleByNumber3] :', input)
  if (!input)
    return "";
  try {
    const source = input.source
    //console.log('source :', source)
    const number = input.number
    //console.log('number :', number)
    const articleSource = source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
    const articleResponse = await getArticle(articleSource, number);
    return `<${articleSource}><article><number> ${articleResponse.number}</number><content>${articleResponse.content}</content><article></${articleSource}>`;
  } catch (error) {
    console.error(`could not get article: ${error}`);
    return "";
  }
}

export async function getArticleByNumber2(input: any) 
{
  console.log('[getArticleByNumber2] :', input)
  if (!input)
    return "";
  try {
    const source = await extractSource(input)
    //console.log('source :', source)
    const number = await extractNumber(input)
    //console.log('number :', number)
    const articleSource = source.charAt(0).toUpperCase() + source.slice(1).toLowerCase();
    const articleResponse = await getArticle(articleSource, number);
    return `<${articleSource}><article><number> ${articleResponse.number}</number><content>${articleResponse.content}</content><article></${articleSource}>`;
  } catch (error) {
    console.error(`could not get article: ${error}`);
    return "";
  }
}