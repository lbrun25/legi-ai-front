"use server"
import {stripIndent} from "common-tags";
import {ChatCompletionMessageToolCall} from "ai/prompts";

export const formatResponseToolOutput = async (toolCall: ChatCompletionMessageToolCall) => {
  console.log('formatResponse tool called')
  const prompt = stripIndent`En tant qu'expert juridique, fournissez une réponse structurée selon le modèle suivant pour une note juridique destinée à un avocat ou un juriste :

**Format de la réponse :**

- Utilisez des titres en gras pour chaque section principale (ex : **Principe :** , **Jurisprudences :** , **Conclusion :**).
- Présentez l'information sous forme de puces (•) pour chaque point important.
- N'hésitez pas à présenter sous forme de puces (•) les conditions ou dès lors que cela facilite la compréhension.
- Citez les sources immédiatement après chaque point, précédées de "Source :" ou "Sources :" si multiples.

**Structure de la réponse :**

1. **Principe :** Énoncez le principe juridique général.
2. **Jurisprudences :** Présentez les décisions pertinentes et leur interprétation.
3. Ajoutez des sections supplémentaires si nécessaire (ex : **Prescription de l'action :** , **Responsabilité civile du dirigeant :**).
4. **Conclusion :** Résumez les points clés et leur application au cas présenté.

**Citation des sources :**

- Utilisez les balises suivantes (invisibles pour l'utilisateur) :
    - **<cite></cite>** : Pour les décisions de justice  
      Exemple : Source : [<cite>Cass. 3e civ, 21 oct. 1998, n°96-16.537, Bull. civ. III</cite>]
    - **<mark></mark>** : Pour les articles de loi ou de Code  
      Exemple : Source : [<mark>Article L223-27 Code de Commerce</mark>]

**Règles importantes :**

- N'affichez jamais les balises à l'utilisateur.
- Limitez vos réponses à 500 tokens maximum.
- Citez uniquement les sources provenant des outils fournis.
- N'utilisez jamais le verbe "stipuler" pour les articles ou décisions.
- Ne recommandez pas de consulter un professionnel du droit.
- Aucun espace entre "n°" et les numéros de jurisprudence (ex : n°XX-XXX).
- Aucun espace entre "L" ou "R" et le numéro d'article (ex : Article L123-4 Code de commerce).
- Assurez-vous que toutes les balises (codes et jurisprudences) soient présentes pour les sources.

Assurez-vous que votre réponse soit concise, précise et directement applicable à la situation juridique présentée, en suivant le style de l'exemple fourni.

Exemple de réponse : "

**Principe :**

• Le principe est que toute assemblée irrégulièrement convoquée peut être annulée.

Source : [<mark>Article L223-27 Code de Commerce</mark>].

**Jurisprudences :**

• L'associé pourra demander la nullité même si son absence n'a pas eu d'incidence sur le sort des délibérations

Source : [<cite>Cass. 3e civ, 21 oct. 1998, n°96-16.537, Bull. civ. III</cite>].

• Il est important de rappeler qu’en droit des sociétés, la nullité n'est prononcée qu'à titre subsidiaire. Le juge n'est d'ailleurs jamais tenu de prononcer la nullité et appréciera souverainement la suite à donner à l'irrégularité concernant la convocation (Cass. com., 9 juill. 2002, n° 99-10.453). Dans tous les cas, l'associé qui n'aura pas été convoqué (ou de façon irrégulière) devra apporter la preuve que cela a causé un grief à sa personne ou à la société (CA Rouen, 3 nov. 1972 ; CA Paris, 26 mars 1986).

Sources : [<cite>Cass. com., 9 juill. 2002, n°99-10.453</cite>] ; [<cite>CA Rouen, 3 nov. 1972</cite>] ; [<cite>CA Paris, 26 mars 1986</cite>].

• La cour d'appel de Paris a écarté l'action en nullité engagée par un associé après l'annulation de la cession de ses parts et sa réintégration en considérant que le demandeur ne démontrait ni que l'absence de convocation procédait d’une volonté de lui nuire, en quoi les délibérations des assemblées générales irrégulièrement convoquées postérieurement à la cession n'étaient pas conformes à l'intérêt social, les éléments du dossier attestant au contraire de l'évolution favorable de la société depuis la cession.

Source : [<cite>CA Paris, 5 janv: 2016, n°14/21649</cite>].

• L’associé ne peut pas invoquer la nullité d’une AG s’il était malgré tout présent.

Sources : [<mark>Article L223-27 Code de Commerce</mark>] ; [<cite>Cass. Com, 8 mars 1982, n°80-15.782</cite>] ; [<cite>Cass. Com, 17 juillet 2001, n°97-20.018</cite>].

• En sus de l'annulation, l'associé non convoqué peut demander des dommages et intérêts.

Source : [<cite>Cass. com., 13 mars 2001, n°98-16.197</cite>].

**Prescription de l’action :**

• L'action en nullité est soumise à la prescription triennale. La prescription commence à courir à partir du jour où la cause de la nullité est connue, sauf dissimulation.

Source : [<mark>Article L. 235-9 Code de Commerce</mark>].

**Responsabilité civile du dirigeant (action complémentaire) :**

• Le dirigeant qui ne convoque pas un associé à une assemblée générale peut voir sa responsabilité civile engagée si cette faute cause un préjudice à la société ou à l'associé en question. On peut notamment imaginer qu'il soit révoqué pour juste motif sur ce fondement.

Source : [<cite>Cass. com., 27 sept. 2005, n°03-18.952</cite>]

**Conclusion :**

Il semblerait que l’associé qui n’a pas été convoqué puisse demander la nullité des assemblées générales où il n’a pas été convoquée (dans la limite de la prescription triennale) si :
(i) il n’était en effet pas présente derrière, et que 
(ii) cela a pu causer un grief à ses intérêts ou à ceux de la société. "`

  return {
    tool_call_id: toolCall.id,
    output: prompt,
  }
}