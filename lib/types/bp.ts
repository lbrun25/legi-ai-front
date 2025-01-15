export interface BpDocumentAiFields {
  absence_maladie_montant: number | null; // 123.35 or null if missing
  avantage_nature_montant: number | null; // -- implies null
  convention_collective: string | null; // -- implies null
  date_anciennete: string | null; // Date as string (e.g., "08/06/2020")
  date_entree_entreprise: string | null; // Date as string (e.g., "08/06/2020")
  debut_periode_emploi: string | null; // Date as string (e.g., "01/09/2021")
  fin_periode_emploi: string | null; // Date as string (e.g., "30/09/2021")
  heure_supplementaires_montant: number | null; // 300.22 or null if missing
  heure_supplementaires_nombre: number | null; // 27.72 or null if missing
  mois_bulletin_de_paie: string | null; // Month as string (e.g., "Septembre 2021")
  nom_salarie: string | null; // -- implies null
  periode_arret_maladie: string | null; // e.g., "020921-030921"
  primes_montant: number | null; // -- implies null
  salaire_base: number | null; // 2102.00 or null if missing
  salaire_brut_mensuel: number | null; // 2251.15 or null if missing
  sous_total_salaire_base_montant: number | null; // 2402.22 or null if missing
}
