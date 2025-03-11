export type BpDocumentAiFields = {
  absences_maladie_montant: number[];
  avantage_en_nature_montant: number[];
  convention_collective: string | null;
  date_anciennete: Date | null;
  date_entree_entreprise: Date | null;
  debut_periode_paie_date: Date | null;
  fin_periode_paie_date: Date | null;
  heures_supplementaires_montant: number[];
  mois_bulletin_de_paie: string | null;
  nom_salarie: string | null;
  periode_arret_maladie: string[];
  primes_montant_valeur: number[];
  salaire_de_base_montant: number | null;
  salaire_brut_montant: number | null;
  salaire_de_base_avant_absences_montant: number | null;
  absences_non_justifiees_montant: number[];
  absence_non_justifie_periode: string[];
  conge_paye_montant: number[];
  conge_paye_periode: string[];
  conge_sans_solde_montant: number[];
  conge_sans_solde_nombre: number[];
  nombre_conge_paye: number[];
  heures_travail: number[];
  majoration_heures_montant: number[];
  primes_annuelles_regulieres: number[];
  employee_qualification: string | null;
  employee_classification_level: string | null;
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

export type FavorableReferenceSalaryCalculationDetails = {
  method: string;
  calculationDetails12Months: ReferenceSalaryCalculationDetails;
  calculationDetails3Months: ReferenceSalaryCalculationDetails;
  referenceSalary: number;
}

export type SeniorityValueResponse = {
  total_years: number;
  total_months: number;
  formatted_duration: string;
}

export type SeniorityResponse = {
  value: SeniorityValueResponse;
  message: string;
}


export type IclFormData = {
  referenceSalary: number,
  legalSeniority: { total_years: number, total_months: number },
  conventionSeniority: { total_years: number, total_months: number },
  legalAdvanceNotice: number,
  conventionAdvanceNotice: number,
}
