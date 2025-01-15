import {BpDocumentAiFields} from "@/lib/types/bp";

export async function parseBpDocumentEntities(response: any): Promise<BpDocumentAiFields> {
  const { document } = await response.json();
  console.log(`Processed document:`, document);

  const defaultFields: BpDocumentAiFields = {
    absence_maladie_montant: null,
    avantage_nature_montant: null,
    convention_collective: null,
    date_anciennete: null,
    date_entree_entreprise: null,
    debut_periode_emploi: null,
    fin_periode_emploi: null,
    heure_supplementaires_montant: null,
    heure_supplementaires_nombre: null,
    mois_bulletin_de_paie: null,
    nom_salarie: null,
    periode_arret_maladie: null,
    primes_montant: null,
    salaire_base: null,
    salaire_brut_mensuel: null,
    sous_total_salaire_base_montant: null,
  };

  if (document && document.entities) {
    document.entities.forEach((entity: any) => {
      const { type: type_, mentionText } = entity;

      switch (type_) {
        case 'absence_maladie_montant':
          defaultFields.absence_maladie_montant = parseFloat(mentionText) || null;
          break;
        case 'avantage_nature_montant':
          defaultFields.avantage_nature_montant = parseFloat(mentionText) || null;
          break;
        case 'convention_collective':
          defaultFields.convention_collective = mentionText || null;
          break;
        case 'date_anciennete':
          defaultFields.date_anciennete = mentionText || null;
          break;
        case 'date_entree_entreprise':
          defaultFields.date_entree_entreprise = mentionText || null;
          break;
        case 'debut_periode_emploi':
          defaultFields.debut_periode_emploi = mentionText || null;
          break;
        case 'fin_periode_emploi':
          defaultFields.fin_periode_emploi = mentionText || null;
          break;
        case 'heure_supplementaires_montant':
          defaultFields.heure_supplementaires_montant = parseFloat(mentionText) || null;
          break;
        case 'heure_supplementaires_nombre':
          defaultFields.heure_supplementaires_nombre = parseFloat(mentionText) || null;
          break;
        case 'mois_bulletin_de_paie':
          defaultFields.mois_bulletin_de_paie = mentionText || null;
          break;
        case 'nom_salarie':
          defaultFields.nom_salarie = mentionText || null;
          break;
        case 'periode_arret_maladie':
          defaultFields.periode_arret_maladie = mentionText || null;
          break;
        case 'primes_montant':
          defaultFields.primes_montant = parseFloat(mentionText) || null;
          break;
        case 'salaire_base':
          defaultFields.salaire_base = parseFloat(mentionText) || null;
          break;
        case 'salaire_brut_mensuel':
          defaultFields.salaire_brut_mensuel = parseFloat(mentionText) || null;
          break;
        case 'sous_total_salaire_base_montant':
          defaultFields.sous_total_salaire_base_montant = parseFloat(mentionText) || null;
          break;
        default:
          console.warn(`Unknown field type: ${type_}`);
      }
    });
  } else {
    console.log('No entities found in the document.');
  }

  return defaultFields;
}
