export type BpDocumentAiFields = {
  absence_maladie_montant: number[];
  avantage_nature_montant: number[];
  convention_collective: string | null;
  date_anciennete: string | null;
  date_entree_entreprise: string | null;
  debut_periode_emploi: string | null;
  fin_periode_emploi: string | null;
  heure_supplementaires_montant: number[];
  mois_bulletin_de_paie: string | null;
  nom_salarie: string | null;
  periode_arret_maladie: string[];
  primes_montant: number[];
  salaire_base: number | null;
  salaire_brut_mensuel: number | null;
  sous_total_salaire_base_montant: number | null;
  absence_non_justifie_montant: number[];
  absence_non_justifie_periode: string[];
  conge_paye_montant: number[];
  conge_paye_periode: string[];
  conge_sans_solde_montant: number[];
  conge_sans_solde_nombre: number[];
  nombre_conge_paye: number[];
  heures_travail: number[];
  majoration_heures_montant: number[];
};

export type BpAnalysis = BpDocumentAiFields & {
  sickLeaveWorkingDays: number;
  unjustifiedAbsenceWorkingDays: number;
};

export type ReferenceSalaryCalculationDetails = {
  method: string;
  calculationSteps: string;
  referenceSalary: number;
};

export type SeniorityValueResponse = {
  total_years: number;
  total_months: number;
  formatted_duration: string;
}
