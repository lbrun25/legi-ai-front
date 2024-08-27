"use server"
import {stripIndent} from "common-tags";
import {ChatCompletionMessageToolCall} from "ai/prompts";

export const formatResponseToolOutput = async (toolCall: ChatCompletionMessageToolCall) => {
  console.log('formatResponse tool called')
  const prompt = stripIndent`Ta réponse doit prendre le modèle d’une note juridique pour un avocat ou un juriste.
  
  Formatage de la réponse  : 
- Vous présentez la réponse de manière claire, précise et synthétique sous forme de puces avec plusieurs sous puces si nécessaire en présence de plusieurs éléments de réponse.
- Vous présentez d'abord les articles de Codes, puis la position de la jurisprudence pour finir avec une interprétation.
- A la fin de chaque paragraphes vous devez : 
    - (1) : Indiquer l’ensemble des sources utilisés dans le bullet à la suite du mot "Source(s) :"
    - (2) : Apres le mot "Source(s)", les différentes sources doivent être encadrées de balises. Exemple : [Paragraphe]. Sources : [<mark>Article X Code Y<\\mark>] ; [<cite>Décisions n°XX-XXXX<\\cite>] ; [<mark>Article Z Code B<\\mark>]

**Vous ne devez pas jamais afficher les balises à l'utilisateur.**

Vous disposez de deux balises : 
- <cite></cite> :  Balises encadrant les numéros de jurisprudences après "Source(s) :" 
Exemple : [paragraphe]. Sources : [<cite>décision n°23-2233</cite>] ; [<cite>Arrêt n°23-2233, de la Cour de Cassation</cite>] ; [<cite>Fiche d'arrêt n°21-13.558, Cour de cassation, 20 octobre 2022</cite>]. 
- <mark></mark> : Balises encadrant les articles de loi, soit de Code après "Source(s) :". 
Exemple : [paragraphe]. Sources : [<mark>Article 13 Code civil</mark>] ; [<mark>1218 Code civil</mark> ] ; [<mark>Article 149-7 Code de la consommation</mark>] ; [<mark>Article L123-2 Code de la Consommation<\\mark>].

Règles importantes sur la forme : 
- **Vous ne devez pas jamais afficher les balises à l'utilisateur.**
- Vous vous assurez qu'il n'y ai aucun espace entre le 'n°' et les numéros quand vous citez une jurisprudence. Ex : n°XX-XXX. 
- Attention certains numéro d'articles peuvent comment par une lettre 'L' ou 'R', vous vous assurez qu'il n'y ai aucun espace entre la lettre et le numéro. Ex : Article L23-2 Code de Procédure Civile.

Règles importantes sur le fond : 
- Vous avez l’interdiction de citer une autre source que celles venant des tools.
- Vous ne devez jamais dire qu’un article ou qu’une décision « stipule ».
`

  return {
    tool_call_id: toolCall.id,
    output: prompt,
  }
}