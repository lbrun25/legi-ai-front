import {
  BpAnalysis,
  BpDocumentAiFields,
  ReferenceSalaryCalculationDetails,
  SeniorityValueResponse
} from "@/lib/types/bp";
import { max } from "mathjs";

export async function parseBpDocumentEntities(response: any): Promise<BpDocumentAiFields> {
  const { document } = await response.json();
  console.log(`Processed document:`, document);

  const defaultFields: BpDocumentAiFields = {
    absence_maladie_montant: [], // Multiple
    absence_non_justifie_montant: [], // Multiple
    absence_non_justifie_periode: [], // Multiple
    avantage_nature_montant: [], // Multiple
    conge_paye_montant: [], // Multiple
    conge_paye_periode: [], // Multiple
    conge_sans_solde_montant: [], // Multiple
    conge_sans_solde_nombre: [], // Multiple
    convention_collective: null, // Unique
    date_anciennete: null, // Unique
    date_entree_entreprise: null, // Unique
    debut_periode_emploi: null, // Unique
    fin_periode_emploi: null, // Unique
    heure_supplementaires_montant: [], // Multiple
    heures_travail: [], // Multiple
    majoration_heures_montant: [], // Multiple
    mois_bulletin_de_paie: null, // Unique
    nom_salarie: null, // Unique
    nombre_conge_paye: [], // Multiple
    periode_arret_maladie: [], // Multiple
    primes_montant: [], // Multiple
    salaire_base: null, // Unique
    salaire_brut_mensuel: null, // Unique
    sous_total_salaire_base_montant: null, // Unique
  };

  if (document && document.entities) {
    document.entities.forEach((entity: any) => {
      const { type: type_, mentionText } = entity;

      switch (type_) {
        case 'absence_maladie_montant':
          if (mentionText) defaultFields.absence_maladie_montant.push(parseFloat(mentionText));
          break;
        case 'absence_non_justifie_montant':
          if (mentionText) defaultFields.absence_non_justifie_montant.push(parseFloat(mentionText));
          break;
        case 'absence_non_justifie_periode':
          if (mentionText) defaultFields.absence_non_justifie_periode.push(mentionText);
          break;
        case 'avantage_nature_montant':
          if (mentionText) defaultFields.avantage_nature_montant.push(parseFloat(mentionText));
          break;
        case 'conge_paye_montant':
          if (mentionText) defaultFields.conge_paye_montant.push(parseFloat(mentionText));
          break;
        case 'conge_paye_periode':
          if (mentionText) defaultFields.conge_paye_periode.push(mentionText);
          break;
        case 'conge_sans_solde_montant':
          if (mentionText) defaultFields.conge_sans_solde_montant.push(parseFloat(mentionText));
          break;
        case 'conge_sans_solde_nombre':
          if (mentionText) defaultFields.conge_sans_solde_nombre.push(parseFloat(mentionText));
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
          if (mentionText) defaultFields.heure_supplementaires_montant.push(parseFloat(mentionText));
          break;
        case 'heures_travail':
          if (mentionText) defaultFields.heures_travail.push(parseFloat(mentionText));
          break;
        case 'majoration_heures_montant':
          if (mentionText) defaultFields.majoration_heures_montant.push(parseFloat(mentionText));
          break;
        case 'mois_bulletin_de_paie':
          defaultFields.mois_bulletin_de_paie = mentionText || null;
          break;
        case 'nom_salarie':
          defaultFields.nom_salarie = mentionText || null;
          break;
        case 'nombre_conge_paye':
          if (mentionText) defaultFields.nombre_conge_paye.push(parseFloat(mentionText));
          break;
        case 'periode_arret_maladie':
          if (mentionText) defaultFields.periode_arret_maladie.push(mentionText);
          break;
        case 'primes_montant':
          if (mentionText) defaultFields.primes_montant.push(parseFloat(mentionText));
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

const getReferenceSalary12MonthsMethod = (bpResponses: BpAnalysis[]): ReferenceSalaryCalculationDetails => {
  const validResponses = bpResponses.filter((response) => response.salaire_brut_mensuel !== null);

  if (validResponses.length < 12) {
    throw new Error("Insufficient data: Less than 12 months of valid salary data.");
  }

  const last12MonthsSalaries = validResponses
    .slice(-12)
    .map((response) => response.salaire_brut_mensuel as number);

  const totalSalary12Months = last12MonthsSalaries.reduce((sum, salary) => sum + salary, 0);
  const averageMonthlySalary = totalSalary12Months / 12;

  const calculationSteps = last12MonthsSalaries
    .map((salary) => salary.toFixed(2))
    .join(" + ") + ` = ${totalSalary12Months.toFixed(2)} ➗ 12 = ${averageMonthlySalary.toFixed(2)}`;

  return {
    method: "12 derniers mois",
    calculationSteps,
    referenceSalary: averageMonthlySalary,
  };
};

const getReferenceSalary3MonthsMethod = (bpResponses: BpAnalysis[]): ReferenceSalaryCalculationDetails => {
  const validResponses = bpResponses.filter((response) => response.salaire_brut_mensuel !== null);

  if (validResponses.length < 3) {
    throw new Error("Insufficient data: Less than 3 months of valid salary data.");
  }

  const lastThreeMonthsSalaries = validResponses
    .slice(-3)
    .map((response) => response.salaire_brut_mensuel as number);

  const totalAnnualBonus = bpResponses.reduce((sum, response) => {
    const bonus = response.primes_montant?.reduce((bonusSum, prime) => bonusSum + prime, 0) || 0;
    return sum + bonus;
  }, 0);

  const monthlyBonus = totalAnnualBonus / 12;

  const adjustedSalaries = lastThreeMonthsSalaries.map((salary) => salary + monthlyBonus);
  const totalAdjustedSalary = adjustedSalaries.reduce((sum, salary) => sum + salary, 0);
  const referenceSalary = totalAdjustedSalary / 3;

  const calculationSteps = lastThreeMonthsSalaries
    .map((salary, i) => `${salary.toFixed(2)} + ${monthlyBonus.toFixed(2)} = ${(salary + monthlyBonus).toFixed(2)}`)
    .join(" ➕ ") + ` ➗ 3 = ${referenceSalary.toFixed(2)}`;

  return {
    method: "3 derniers mois",
    calculationSteps,
    referenceSalary,
  };
};

export const getFavorableReferenceSalary = (bpResponses: BpAnalysis[]): ReferenceSalaryCalculationDetails => {
  const details12Months = getReferenceSalary12MonthsMethod(bpResponses);
  const details3Months = getReferenceSalary3MonthsMethod(bpResponses);

  let favorableSalaryMessage = `1) Calcul du salaire de référence 🤑: \n\n\n`;
  favorableSalaryMessage += `Méthode 12 derniers mois : ${details12Months.calculationSteps} = ${details12Months.referenceSalary.toFixed(2)} \n\n`;
  favorableSalaryMessage += `Méthode 3 derniers mois : ${details3Months.calculationSteps} = ${details3Months.referenceSalary.toFixed(2)} \n\n`;

  if (details12Months.referenceSalary > details3Months.referenceSalary) {
    favorableSalaryMessage += `Le salaire de référence ${details12Months.referenceSalary.toFixed(2)} est plus favorable car ${details12Months.referenceSalary.toFixed(2)} > ${details3Months.referenceSalary.toFixed(2)}. Nous allons retenir celui-ci pour la suite des calculs.`;
  } else {
    favorableSalaryMessage += `Le salaire de référence ${details3Months.referenceSalary.toFixed(2)} est plus favorable car ${details3Months.referenceSalary.toFixed(2)} > ${details12Months.referenceSalary.toFixed(2)}. Nous allons retenir celui-ci pour la suite des calculs.`;
  }

  const favorableReferenceSalary = max(details12Months.referenceSalary, details3Months.referenceSalary);

  return {
    method: "favorable",
    calculationSteps: favorableSalaryMessage,
    referenceSalary: favorableReferenceSalary,
  };
};

export const sumPrimesMontant = (documents: BpDocumentAiFields[]): number => {
  return documents.reduce((total, doc) => {
    const primesSum = doc.primes_montant?.reduce((sum, prime) => sum + prime, 0) || 0;
    return total + primesSum;
  }, 0);
};

export const sumFringeBenefits = (documents: BpDocumentAiFields[]): number => {
  return documents.reduce((total, doc) => {
    const fringeBenefitsSum = doc.avantage_nature_montant?.reduce((sum, benefit) => sum + benefit, 0) || 0;
    return total + fringeBenefitsSum;
  }, 0);
};

export const removeOverlappingPeriods = (doc: BpDocumentAiFields): BpDocumentAiFields => {
  console.log("Original `periode_arret_maladie`:", doc.periode_arret_maladie);
  console.log("Original `absence_non_justifie_periode`:", doc.absence_non_justifie_periode);

  const filteredAbsenceNonJustifiePeriode = doc.absence_non_justifie_periode.filter((absencePeriod) => {
    const isOverlapping = doc.periode_arret_maladie.includes(absencePeriod);
    console.log(`Checking period "${absencePeriod}" against "periode_arret_maladie" -> Overlap: ${isOverlapping}`);
    return !isOverlapping; // Keep periods that are not overlapping
  });

  console.log("Filtered `absence_non_justifie_periode`:", filteredAbsenceNonJustifiePeriode);

  return {
    ...doc,
    absence_non_justifie_periode: filteredAbsenceNonJustifiePeriode,
  };
};

export const getSeniorityWithAdvanceNotice = (seniority: SeniorityValueResponse, advanceNotice: string): string => {
  console.log('getSeniorityWithAdvanceNotice advanceNotice:', advanceNotice)
  const cleanedAdvanceNotice = advanceNotice.replace("mois", "");
  const advanceNoticeNumber = parseInt(cleanedAdvanceNotice);
  const totalMonths = seniority.total_months + advanceNoticeNumber;
  return `${seniority.total_years} ans et ${totalMonths} mois`;
}

export function calculateLegalSeverancePay(
  referenceSalary: number,
  seniority: SeniorityValueResponse
): number {
  const { total_years, total_months } = seniority;

  // Calculate full years indemnity
  const yearsUpToTen = Math.min(total_years, 10); // Up to 10 years
  const yearsBeyondTen = Math.max(total_years - 10, 0); // Beyond 10 years

  const indemnityForYearsUpToTen = referenceSalary * (1 / 4) * yearsUpToTen;
  const indemnityForYearsBeyondTen = referenceSalary * (1 / 3) * yearsBeyondTen;

  // Calculate months indemnity (proportional to years up to 10)
  let monthsIndemnity = 0;
  if (total_years < 10) {
    monthsIndemnity = referenceSalary * (1 / 4) * (total_months / 12);
  } else {
    monthsIndemnity = referenceSalary * (1 / 3) * (total_months / 12);
  }

  // Total indemnity
  const totalIndemnity =
    indemnityForYearsUpToTen + indemnityForYearsBeyondTen + monthsIndemnity;

  return parseFloat(totalIndemnity.toFixed(2)); // Return with 2 decimal places
}

export const compareAdvanceNotice = (legalAdvanceNotice: string, conventionAdvanceNotice: string) => {
  const legalMonthsStr = legalAdvanceNotice.replace("mois", "");
  const legalAdvanceNoticeNumber = parseInt(legalMonthsStr);
  const conventionMonthsStr = conventionAdvanceNotice.replace("mois", "");
  const conventionAdvanceNoticeNumber = parseInt(conventionMonthsStr);
  return legalAdvanceNoticeNumber > conventionAdvanceNoticeNumber ? legalAdvanceNotice : conventionAdvanceNotice;
}
