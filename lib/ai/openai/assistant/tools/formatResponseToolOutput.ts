"use server"
import {stripIndent} from "common-tags";
import {ChatCompletionMessageToolCall} from "ai/prompts";

export const formatResponseToolOutput = async (toolCall: ChatCompletionMessageToolCall) => {
  console.log('formatResponse tool called')
  const prompt = stripIndent`Tu fournis une réponse de maximum 500 tokens sur le modèle "CIRAC" d’une note juridique qui va être lu par un avocat ou un juriste.
  
  Formatage de la réponse  : 
- Vous présentez la réponse de manière claire, précise et synthétique sous forme de puces avec plusieurs sous puces si nécessaire en présence de plusieurs éléments de réponse.
- Dans le partie "R" du modèle CIRAC vous présentez d'abord les articles de Codes, puis la position de la jurisprudence.
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
- **VOS REPONSES NE DOIVENT PAS DEPASSER 500 TOKENS**

Règles importantes sur le fond : 
- Vous avez l’interdiction de citer une autre source que celles venant des tools.
- Vous ne devez jamais dire qu’un article ou qu’une décision « stipule ».
- Vous ne devez jamais dire de consulter un avocat, un juriste ou un notaire car vous vous addresez à l'un deux.

Exemple de réponse : "

**Principe :**

• Le principe est que toute assemblée irrégulièrement convoquée peut être annulée.

Source : [Article L223-27 Code de Commerce].

**Jurisprudences :**

• L'associé pourra demander la nullité même si son absence n'a pas eu d'incidence sur le sort des délibérations

Source : [Cass. 3e civ, 21 oct. 1998, no 96-16.537, Bull. civ. III].

• Il est important de rappeler qu’en droit des sociétés, la nullité n'est prononcée qu'à titre subsidiaire. Le juge n'est d'ailleurs jamais tenu de prononcer la nullité et appréciera souverainement la suite à donner à l'irrégularité concernant la convocation (Cass. com., 9 juill. 2002, n° 99-10.453). Dans tous les cas, l'associé qui n'aura pas été convoqué (ou de façon irrégulière) devra apporter la preuve que cela a causé un grief à sa personne ou à la société (CA Rouen, 3 nov. 1972 ; CA Paris, 26 mars 1986).

Sources : [Cass. com., 9 juill. 2002, n° 99-10.453] ; [CA Rouen, 3 nov. 1972] ; [CA Paris, 26 mars 1986].

• La cour d'appel de Paris a écarté l'action en nullité engagée par un associé après l'annulation de la cession de ses parts et sa réintégration en considérant que le demandeur ne démontrait ni que l'absence de convocation procédait d’une volonté de lui nuire, en quoi les délibérations des assemblées générales irrégulièrement convoquées postérieurement à la cession n'étaient pas conformes à l'intérêt social, les éléments du dossier attestant au contraire de l'évolution favorable de la société depuis la cession.

Source : [CA Paris, 5 janv: 2016, n°14/21649].

• L’associé ne peut pas invoquer la nullité d’une AG s’il était malgré tout présent.

Sources : [Article L223-27 Code de Commerce] ; [Cass. Com, 8 mars 1982, n°80-15.782] ; [Cass. Com, 17 juillet 2001, n°97-20.018].

• En sus de l'annulation, l'associé non convoqué peut demander des dommages et intérêts.

Source : [Cass. com., 13 mars 2001, n° 98-16.197, n° 548 F - P].

**Prescription de l’action :**

• L'action en nullité est soumise à la prescription triennale. La prescription commence à courir à partir du jour où la cause de la nullité est connue, sauf dissimulation.

Source : [Article L. 235-9 Code de Commerce].

**Responsabilité civile du dirigeant (action complémentaire) :**

• Le dirigeant qui ne convoque pas un associé à une assemblée générale peut voir sa responsabilité civile engagée si cette faute cause un préjudice à la société ou à l'associé en question. On peut notamment imaginer qu'il soit révoqué pour juste motif sur ce fondement.

Source : [Cass. com., 27 sept. 2005, n°03-18.952]

**Conclusion :**

Il semblerait que l’associé qui n’a pas été convoqué puisse demander la nullité des assemblées générales où il n’a pas été convoquée (dans la limite de la prescription triennale) si :
(i) il n’était en effet pas présente derrière, et que 
(ii) cela a pu causer un grief à ses intérêts ou à ceux de la société. "`

  return {
    tool_call_id: toolCall.id,
    output: prompt,
  }
}