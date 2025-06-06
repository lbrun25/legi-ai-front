import {
  BpAnalysis,
  BpDocumentAiFields,
  FavorableReferenceSalaryCalculationDetails,
  ReferenceSalaryCalculationDetails,
  SeniorityValueResponse
} from "@/lib/types/bp";
import {max} from "mathjs";
import {extractFirstPageAsBase64} from "@/lib/utils/file";
import moment from "moment";
import "moment/locale/fr";
import { MatchedCollectiveAgreementDocument } from "../supabase/agreements";

export async function parseBpDocumentEntities(document: any): Promise<BpDocumentAiFields> {
  console.log(`Processed document:`, document);

  const defaultFields: BpDocumentAiFields = {
    absences_maladie_montant: [], // Multiple
    absences_non_justifiees_montant: [], // Multiple
    absence_non_justifie_periode: [], // Multiple
    avantage_en_nature_montant: [], // Multiple
    conge_paye_montant: [], // Multiple
    conge_paye_periode: [], // Multiple
    conge_sans_solde_montant: [], // Multiple
    conge_sans_solde_nombre: [], // Multiple
    convention_collective: null, // Unique
    date_anciennete: null, // Unique
    date_entree_entreprise: null, // Unique
    debut_periode_paie_date: null, // Unique
    fin_periode_paie_date: null, // Unique
    heures_supplementaires_montant: [], // Multiple
    heures_travail: [], // Multiple
    majoration_heures_montant: [], // Multiple
    mois_bulletin_de_paie: null, // Unique
    nom_salarie: null, // Unique
    nombre_conge_paye: [], // Multiple
    periode_arret_maladie: [], // Multiple
    primes_montant_valeur: [], // Multiple
    salaire_de_base_montant: null, // Unique
    salaire_brut_montant: null, // Unique
    salaire_de_base_avant_absences_montant: null, // Unique
    primes_annuelles_regulieres: [],
    employee_qualification: null,
    employee_classification_level: null,
    boundingBoxes: {},
  };

  if (document && document.entities) {
    document.entities.forEach((entity: any) => {
      const { type: type_, mentionText, normalizedValue, pageAnchor } = entity;
      const normalizedText = normalizedValue?.text;

      console.log('entity:', entity)

      // Extract bounding box if available
      if (pageAnchor?.pageRefs) {
        pageAnchor.pageRefs.forEach((pageRef: any) => {
          const pageNumber = parseInt(pageRef.page, 10); // Ensure it's a number
          const boundingPoly = pageRef.boundingPoly;

          if (boundingPoly?.normalizedVertices && boundingPoly.normalizedVertices.length > 0) {
            if (!defaultFields.boundingBoxes[type_]) {
              defaultFields.boundingBoxes[type_] = [];
            }
            defaultFields.boundingBoxes[type_].push({
              page: pageNumber, // Store the page number for later use
              normalizedVertices: boundingPoly.normalizedVertices,
            });
          }
        });
      }

      switch (type_) {
        case 'absences_maladie_montant':
          if (normalizedText) defaultFields.absences_maladie_montant.push(parseFloat(normalizedText));
          break;
        case 'absences_non_justifiees_montant':
          if (normalizedText) defaultFields.absences_non_justifiees_montant.push(parseFloat(normalizedText));
          break;
        case 'absence_non_justifie_periode':
          if (mentionText) defaultFields.absence_non_justifie_periode.push(mentionText);
          break;
        case 'avantage_en_nature_montant':
          if (normalizedText) {
            const value = parseFloat(normalizedText);
            if (!defaultFields.avantage_en_nature_montant.includes(value)) {
              defaultFields.avantage_en_nature_montant.push(value);
            }
          }
          break;
        case 'conge_paye_montant':
          // TODO: delete the condition when the OCR is more accurate (do not confond conge paye indemnities and conge paye absence)
          if (normalizedText) {
            const value = parseFloat(normalizedText);
            if (!defaultFields.conge_paye_montant.includes(value)) {
              defaultFields.conge_paye_montant.push(value);
            }
          }
          break;
        case 'conge_paye_periode':
          if (mentionText) defaultFields.conge_paye_periode.push(mentionText);
          break;
        case 'conge_sans_solde_montant':
          if (normalizedText) defaultFields.conge_sans_solde_montant.push(parseFloat(normalizedText));
          break;
        case 'conge_sans_solde_nombre':
          if (normalizedText) defaultFields.conge_sans_solde_nombre.push(parseFloat(normalizedText));
          break;
        case 'convention_collective':
          defaultFields.convention_collective = mentionText || null;
          break;
        case 'date_anciennete':
          if (normalizedText) defaultFields.date_anciennete = new Date(normalizedText);
          break;
        case 'date_entree_entreprise':
          if (normalizedText) defaultFields.date_entree_entreprise = new Date(normalizedText);
          break;
        case 'debut_periode_paie_date':
          if (normalizedText) defaultFields.debut_periode_paie_date = new Date(normalizedText);
          break;
        case 'fin_periode_paie_date':
          if (normalizedText) defaultFields.fin_periode_paie_date = new Date(normalizedText);
          break;
        case 'heures_supplementaires_montant':
          if (normalizedText) defaultFields.heures_supplementaires_montant.push(parseFloat(normalizedText));
          break;
        case 'heures_travail':
          if (normalizedText) defaultFields.heures_travail.push(parseFloat(normalizedText));
          break;
        case 'majoration_heures_montant':
          if (normalizedText) defaultFields.majoration_heures_montant.push(parseFloat(normalizedText));
          break;
        case 'mois_bulletin_de_paie':
          defaultFields.mois_bulletin_de_paie = mentionText || null;
          break;
        case 'nom_salarie':
          defaultFields.nom_salarie = mentionText || null;
          break;
        case 'nombre_conge_paye':
          if (normalizedText) defaultFields.nombre_conge_paye.push(parseFloat(normalizedText));
          break;
        case 'periode_arret_maladie':
          if (mentionText) defaultFields.periode_arret_maladie.push(mentionText);
          break;
        case 'primes_montant_valeur':
          if (normalizedText) defaultFields.primes_montant_valeur.push(parseFloat(normalizedText));
          break;
        case 'salaire_de_base_montant':
          defaultFields.salaire_de_base_montant = parseFloat(normalizedText) || null;
          break;
        case 'salaire_brut_montant':
          defaultFields.salaire_brut_montant = parseFloat(normalizedText) || null;
          break;
        case 'salaire_de_base_avant_absences_montant':
          defaultFields.salaire_de_base_avant_absences_montant = parseFloat(normalizedText) || null;
          break;
        case 'primes_annuelles_regulieres':
          if (normalizedText) defaultFields.primes_annuelles_regulieres.push(parseFloat(normalizedText));
          break;
        case 'employee_qualification':
          defaultFields.employee_qualification = mentionText || null;
          break;
        case 'employee_classification_level':
          defaultFields.employee_classification_level = mentionText || null;
          break;
        default:
          console.warn(`Unknown field type: ${type_}`);
      }
    });
  } else {
    console.log('No entities found in the document.');
  }

  // Convert mois_bulletin_de_paie to debut_periode_paie_date if debut_periode_paie_date is undefined (which is necessary to sort BPs)
  if (!document.debut_periode_paie_date && document.mois_bulletin_de_paie) {
    const momentDate = moment(document.mois_bulletin_de_paie, "MMMM YYYY", "fr");
    if (momentDate.isValid()) {
      document.debut_periode_paie_date = momentDate.toDate();
    } else {
      console.error("Invalid date format:", document.mois_bulletin_de_paie);
    }
  }
  // Convert mois_bulletin_de_paie to fin_periode_paie_date if fin_periode_paie_date is undefined (should be the last day of the month)
  if (!document.fin_periode_paie_date && document.mois_bulletin_de_paie) {
    const momentDate = moment(document.mois_bulletin_de_paie, "MMMM YYYY", "fr");
    if (momentDate.isValid()) {
      // Set the date to the end of the month (handles 28/29/30/31 days automatically)
      document.fin_periode_paie_date = momentDate.endOf('month').toDate();
    } else {
      console.error("Invalid date format:", document.mois_bulletin_de_paie);
    }
  }


  return defaultFields;
}

const getReferenceSalary12MonthsMethod = (bpResponses: BpAnalysis[]): ReferenceSalaryCalculationDetails => {
  console.log('getReferenceSalary12MonthsMethod bpResponses.length:', bpResponses.length);
  console.log('getReferenceSalary12MonthsMethod bpResponses:', bpResponses);
  const validResponses = bpResponses.filter((response) => response.salaire_brut_montant !== null);

  if (validResponses.length < 12) {
    throw new Error("Insufficient data: Less than 12 months of valid salary data.");
  }

  const last12MonthsSalaries = validResponses
    .slice(-12)
    .map((response) => response.salaire_brut_montant as number);

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
  const validResponses = bpResponses.filter((response) => response.salaire_brut_montant !== null);

  if (validResponses.length < 3) {
    throw new Error("Insufficient data: Less than 3 months of valid salary data.");
  }

  const lastThreeMonthsResponses = validResponses.slice(-3);

  const lastThreeMonthsSalaries = lastThreeMonthsResponses.map(
    (response) => response.salaire_brut_montant as number
  );

  const totalAnnualBonus = lastThreeMonthsResponses.reduce((sum, response) => {
    const bonus = response.primes_annuelles_regulieres?.reduce((bonusSum, prime) => bonusSum + prime, 0) || 0;
    return sum + bonus;
  }, 0);

  const monthlyBonus = totalAnnualBonus / 12;

  const adjustedSalaries = lastThreeMonthsSalaries.map((salary) => salary + monthlyBonus);
  const totalAdjustedSalary = adjustedSalaries.reduce((sum, salary) => sum + salary, 0);
  const referenceSalary = totalAdjustedSalary / 3;

  const calculationSteps = `(${lastThreeMonthsSalaries
    .map((salary) => `${salary.toFixed(2)} + ${monthlyBonus.toFixed(2)}`)
    .join(") ➕ (")}) ➗ 3 = ${referenceSalary.toFixed(2)}`;

  return {
    method: "3 derniers mois",
    calculationSteps,
    referenceSalary,
  };
};

export const getFavorableReferenceSalary = (bpResponses: BpAnalysis[]): FavorableReferenceSalaryCalculationDetails => {
  const details12Months = getReferenceSalary12MonthsMethod(bpResponses);
  const details3Months = getReferenceSalary3MonthsMethod(bpResponses);

  const favorableReferenceSalary = max(details12Months.referenceSalary, details3Months.referenceSalary);

  return {
    method: "favorable",
    calculationDetails12Months: details12Months,
    calculationDetails3Months: details3Months,
    referenceSalary: favorableReferenceSalary,
  };
};

export const sumPrimesMontant = (documents: BpDocumentAiFields[]): number => {
  return documents.reduce((total, doc) => {
    const primesSum = doc.primes_montant_valeur?.reduce((sum, prime) => sum + prime, 0) || 0;
    return total + primesSum;
  }, 0);
};

export const sumFringeBenefits = (documents: BpDocumentAiFields[]): number => {
  return documents.reduce((total, doc) => {
    const fringeBenefitsSum = doc.avantage_en_nature_montant?.reduce((sum, benefit) => sum + benefit, 0) || 0;
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

export const getSeniorityWithAdvanceNotice = (seniority: SeniorityValueResponse, advanceNotice: string): SeniorityValueResponse => {
  console.log('getSeniorityWithAdvanceNotice advanceNotice:', advanceNotice)
  const cleanedAdvanceNotice = advanceNotice.replace("mois", "");
  const advanceNoticeNumber = parseInt(cleanedAdvanceNotice);
  const totalMonths = seniority.total_months + advanceNoticeNumber;
  return {
    total_years: seniority.total_years,
    total_months: totalMonths,
    formatted_duration: `${seniority.total_years} ans et ${totalMonths} mois`,
  }
}

export type LegalSeverancePayResult = {
  value: number;
  calculationSteps: string;
};

export type ConventionSeverancePayResult = {
  message: string,
  value: number,
  relevantArticles: MatchedCollectiveAgreementDocument[],
}

export function calculateLegalSeverancePay(
  referenceSalary: number,
  seniority: { total_years: number; total_months: number }
): LegalSeverancePayResult {
  const { total_years, total_months } = seniority;

  // Define fixed rates
  const rateForYearsUpToTen = 1 / 4;
  const rateForYearsBeyondTen = 1 / 3;
  const rateForMonths = total_years < 10 ? 1 / 4 : 1 / 3;

  // Determine the number of full years in each bracket
  const yearsUpToTen = Math.min(total_years, 10);
  const yearsBeyondTen = Math.max(total_years - 10, 0);

  // Calculate each indemnity component
  const indemnityForYearsUpToTen = referenceSalary * rateForYearsUpToTen * yearsUpToTen;
  const indemnityForYearsBeyondTen = referenceSalary * rateForYearsBeyondTen * yearsBeyondTen;
  const indemnityForMonths = referenceSalary * rateForMonths * (total_months / 12);

  // Total indemnity rounded to 2 decimals
  const totalIndemnity = indemnityForYearsUpToTen + indemnityForYearsBeyondTen + indemnityForMonths;
  const roundedValue = Math.round(totalIndemnity * 100) / 100;

  // Prepare string representations for the rates (rounded to 2 decimals for clarity)
  const rateYearsUpToTenStr = rateForYearsUpToTen.toFixed(2); // "0.25"
  const rateYearsBeyondTenStr = rateForYearsBeyondTen.toFixed(2); // "0.33"
  const rateMonthsStr = rateForMonths.toFixed(2); // "0.25" or "0.33"

  // Build a concise formula string with the actual computed values:
  const calculationSteps =
    `${referenceSalary} × [ (${rateYearsUpToTenStr} × ${yearsUpToTen}) + (${rateYearsBeyondTenStr} × ${yearsBeyondTen}) + (${rateMonthsStr} × (${total_months} / 12)) ]`;

  return { value: roundedValue, calculationSteps };
}

export const getAdvanceNoticeNumber = (advanceNotice: string) => {
  const monthsStr = advanceNotice.replace("mois", "");
  return parseInt(monthsStr);
}

export const compareAdvanceNotice = (legalAdvanceNotice: string, conventionAdvanceNotice: string) => {
  const legalMonthsStr = legalAdvanceNotice.replace("mois", "");
  const legalAdvanceNoticeNumber = parseInt(legalMonthsStr);
  const conventionMonthsStr = conventionAdvanceNotice.replace("mois", "");
  const conventionAdvanceNoticeNumber = parseInt(conventionMonthsStr);
  return legalAdvanceNoticeNumber > conventionAdvanceNoticeNumber ? legalAdvanceNotice : conventionAdvanceNotice;
}

// Helper function to parse date strings in "DD/MM/YYYY" format
function parseDate(str: string): Date {
  const [day, month, year] = str.split('/').map((num) => parseInt(num, 10));
  return new Date(year, month - 1, day); // Note: month is zero-based
}

// Helper function to calculate seniority in years and months
// avec la règle : "au-delà d'une semaine, c'est un mois complet"
export function calculateSeniority(endDate: Date, startDate: Date): SeniorityValueResponse {
  // Calcul initial en mois (basé sur la différence d'années et de mois)
  let baseMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12
    + (endDate.getMonth() - startDate.getMonth());

  // Construire la date anniversaire = startDate + baseMonths mois
  let anniversary = new Date(startDate);
  anniversary.setMonth(anniversary.getMonth() + baseMonths);

  // Si l'anniversaire dépasse la date de fin, on retire un mois
  if (anniversary > endDate) {
    baseMonths--;
    anniversary = new Date(startDate);
    anniversary.setMonth(anniversary.getMonth() + baseMonths);
  }

  // Calculer la différence en jours entre la date anniversaire et la date de fin
  const diffTime = endDate.getTime() - anniversary.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);

  // Si le reste est d'au moins 7 jours, on considère ce mois comme complet
  if (diffDays >= 7) {
    baseMonths++;
  }

  const years = Math.floor(baseMonths / 12);
  const months = baseMonths % 12;
  const formattedDuration = `${years} ans et ${months} mois`;

  return { total_years: years, total_months: months, formatted_duration: formattedDuration };
}

// Helper function to convert seniority to total days
function seniorityToDays(seniority: SeniorityValueResponse): number {
  const totalYearsInDays = seniority.total_years * 365; // Approximation : 365 jours par an
  const totalMonthsInDays = seniority.total_months * 30;  // Approximation : 30 jours par mois
  return totalYearsInDays + totalMonthsInDays;
}

// Helper function to convert total days to seniority (years and months)
function daysToSeniority(totalDays: number): SeniorityValueResponse {
  console.log('totalDays', totalDays);
  const totalMonths = Math.floor(totalDays / 30); // Conversion des jours en mois (approximation)
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const formattedDuration = `${years} ans et ${months} mois`;
  return { total_years: years, total_months: months, formatted_duration: formattedDuration };
}

const normalizeDate = (dateStr: string): string => {
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`; // Convert to DD/MM/YYYY format
  }
  return dateStr; // Return as-is if already in desired format
};

// Main function to calculate seniority with absences
export function calculateSeniorityWithAbsences(
  endDate: Date,
  startDate: Date,
  absenceDays: number
): SeniorityValueResponse {
  if (startDate > endDate) {
    throw new Error('startDate must be earlier than endDate');
  }

  // Calculer la séniorité initiale en tenant compte de la nouvelle règle
  const initialSeniority = calculateSeniority(endDate, startDate);

  // Convertir la séniorité en jours et soustraire les jours d'absence
  const totalDays = seniorityToDays(initialSeniority);
  console.log('totalDays:', totalDays);
  const adjustedTotalDays = Math.max(0, totalDays - absenceDays); // Éviter les jours négatifs
  console.log('adjustedTotalDays:', adjustedTotalDays);

  // Conversion du total de jours ajusté en séniorité
  const adjustedSeniority = daysToSeniority(adjustedTotalDays);

  return adjustedSeniority;
}

export function parseAndReplace(expression: string, replacements: Record<string, number>): string {
  // Replace placeholders [PLACEHOLDER] with their corresponding values
  const replacedExpression = expression.replace(/\[([A-Z_]+)\]/g, (_, placeholder) => {
    if (replacements[placeholder] !== undefined) {
      return replacements[placeholder].toString();
    } else {
      throw new Error(`Valeur manquante pour le placeholder: [${placeholder}]`);
    }
  });

  // Replace all commas with dots in the entire result string
  return replacedExpression.replace(/,/g, '.');
}

export function evaluateMathExpression(expression: string): number {
  // Utiliser Function pour évaluer l'expression mathématique
  try {
    return new Function(`return (${expression});`)();
  } catch (error) {
    throw new Error(`Erreur lors de l'évaluation de l'expression: ${expression}`);
  }
}

// Utility function to fetch working days.
// 'extractDays' is a function to extract the desired field from the API response.
export async function fetchWorkingDays(
  payload: object,
  errorMessage: string,
  extractDays: (data: any) => number
): Promise<number> {
  const response = await fetch("/api/bp/analysis/getSickLeaveDays", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(errorMessage);
    return 0;
  }

  const data = await response.json();
  return extractDays(data) || 0;
}

const getTotalWorkingDays = async (
  periods: any[],
  bpName: string,
  payloadKey: string,
  extractKey: string
): Promise<number> => {
  const fetchPromises = periods.map((period) => {
    if (!period) return Promise.resolve(0);
    const payload = { [payloadKey]: period };
    const errorMessage = `Failed to extract ${extractKey} for period: ${period} in ${bpName}`;
    return fetchWorkingDays(payload, errorMessage, (data) => data[extractKey]);
  });
  const daysArray = await Promise.all(fetchPromises);
  return daysArray.reduce((total, days) => total + days, 0);
};


export function getBpName(bp: BpDocumentAiFields): string {
  if (bp.mois_bulletin_de_paie) {
    return `${bp.mois_bulletin_de_paie}`;
  }
  return `Du ${bp.debut_periode_paie_date?.toLocaleDateString("fr-FR")} au ${bp.fin_periode_paie_date?.toLocaleDateString("fr-FR")}`;
}

export async function processBpInfos(results: BpDocumentAiFields[]): Promise<BpAnalysis[]> {
  const updatedInfos: BpAnalysis[] = [];

  const fetchPromises = results.map(async (bp) => {
    if (!bp) return;
    const bpName = getBpName(bp);
    const sickLeavePeriods = bp.periode_arret_maladie || [];
    const unjustifiedAbsencePeriods = bp.absence_non_justifie_periode || [];

    try {
      // Calculate totals for each period type using the helper.
      const totalSickLeaveWorkingDays = await getTotalWorkingDays(
        sickLeavePeriods,
        bpName,
        "sickLeavePeriod",
        "sickLeaveWorkingDays"
      );
      const totalUnjustifiedAbsenceWorkingDays = await getTotalWorkingDays(
        unjustifiedAbsencePeriods,
        bpName,
        "unjustifiedAbsencePeriod",
        "unjustifiedAbsenceWorkingDays"
      );

      // Build the updated BpAnalysis object.
      updatedInfos.push({
        ...bp,
        sickLeaveWorkingDays: totalSickLeaveWorkingDays,
        unjustifiedAbsenceWorkingDays: totalUnjustifiedAbsenceWorkingDays,
      });
    } catch (error) {
      console.error(`Error processing file ${bpName}:`, error);
    }
  });

  // Wait for all processing to finish.
  await Promise.all(fetchPromises);

  return updatedInfos;
}

export const computeEarnedPaidLeave = (doc: BpDocumentAiFields[]): number => {
  return doc.reduce((total, field) => {
    if (!field.nombre_conge_paye || field.nombre_conge_paye.length === 0) return total;
    // Déduplique le tableau en utilisant un Set
    console.log('field.debut_periode_paie_date', field.debut_periode_paie_date)
    console.log('field.nombre_conge_paye:', field.nombre_conge_paye)
    const uniquePaidLeaves = Array.from(new Set(field.nombre_conge_paye));
    const totalPaidLeave = uniquePaidLeaves.reduce((sum, leave) => sum + leave, 0);
    return total + totalPaidLeave;
  }, 0);
};

export const getBrutDuringSickLeavePeriod = (doc: BpDocumentAiFields): number | null => {
  console.log('doc.periode_arret_maladie:', doc.periode_arret_maladie)
  if (doc.periode_arret_maladie.length > 0) {
    if (doc.salaire_de_base_avant_absences_montant) {
      let brut = doc.salaire_de_base_avant_absences_montant;
      if (doc.salaire_brut_montant) {
        brut = doc.salaire_brut_montant > doc.salaire_de_base_avant_absences_montant ? doc.salaire_brut_montant : doc.salaire_de_base_avant_absences_montant;
      }
      console.log('return doc.sous_total_salaire_base_montant for:', doc.mois_bulletin_de_paie);
      console.log('doc.absences_non_justifiees_montant:', doc.absences_non_justifiees_montant);
      if (doc.absences_non_justifiees_montant.length > 0) {
        const totalUnjustifiedAbsence = doc.absences_non_justifiees_montant.reduce((sum, amount) => sum + amount, 0);
        console.log('return brut - totalUnjustifiedAbsence:', brut - totalUnjustifiedAbsence)
        return brut - totalUnjustifiedAbsence;
      }
      console.log('return brut:', brut)
      return brut;
    }
    // if (doc.salaire_brut_montant && doc.absences_maladie_montant.length > 0) {
    //   const totalAbsenceMaladie = doc.absences_maladie_montant.reduce((sum, amount) => sum + amount, 0);
    //   console.log('return oc.salaire_brut_mensuel - totalAbsenceMaladie:', doc.salaire_brut_montant - totalAbsenceMaladie)
    //   return doc.salaire_brut_montant - totalAbsenceMaladie;
    // }
  }
  console.log('return doc.salaire_brut_mensuel:', doc.salaire_brut_montant)
  return doc.salaire_brut_montant;
};

/**
 * Processes a single PDF file and returns its extracted BP document.
 */
export async function processPdfFile(pdfFile: File): Promise<BpDocumentAiFields | null> {
  const getCacheKey = (file: File) => `ocr_${file.name}`;
  const cacheKey = getCacheKey(pdfFile);
  // const isDevelopment = process.env.NODE_ENV === "development";
  // let cachedDocument = isDevelopment ? localStorage.getItem(cacheKey) : null;
  const isDevelopment = false;
  let cachedDocument = null;

  if (!cachedDocument) {
    // Extract the first page as Base64
    const encodedFileContent = await extractFirstPageAsBase64(pdfFile);
    const response = await fetch("/api/assistant/files/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encodedFileContent }),
    });
    if (!response.ok) {
      throw new Error(`OCR API error for ${pdfFile.name}: ${response.statusText}`);
    }
    const { document } = await response.json();
    // Assume the response body is text or JSON that you need to process.
    // Adjust accordingly if you expect JSON.
    cachedDocument = document;
    if (isDevelopment) {
      localStorage.setItem(cacheKey, JSON.stringify(cachedDocument));
    }
  }

  console.log("response ocr document:", cachedDocument);
  let documentEntities = await parseBpDocumentEntities(cachedDocument);
  documentEntities = removeOverlappingPeriods(documentEntities);

  // Determine a "month" identifier for this document.
  const month =
    documentEntities.mois_bulletin_de_paie ??
    `${documentEntities.debut_periode_paie_date?.toLocaleDateString("fr-FR")}-${documentEntities.fin_periode_paie_date?.toLocaleDateString("fr-FR")}`;

  if (!month) {
    console.error(`Month not found in document for ${pdfFile.name}`);
    return null;
  }

  // Optionally, you could attach the month to the document if needed:
  // documentEntities.month = month;

  // Adjust the salary during sick leave if needed.
  if (documentEntities.absences_maladie_montant || documentEntities.periode_arret_maladie) {
    const brut = parseFloat(
      (getBrutDuringSickLeavePeriod(documentEntities)?.toFixed(2) ?? "0")
    );
    if (brut) {
      console.log(
        `Changing salaire_brut_mensuel from ${documentEntities.salaire_brut_montant} to ${brut}`
      );
      documentEntities.salaire_brut_montant = brut;
    }
  }
  return documentEntities;
}

export function getEntryDate(bps: BpDocumentAiFields[]): Date | null {
  for (const bp of bps) {
    if (bp.date_entree_entreprise !== null) {
      return bp.date_entree_entreprise;
    }
  }
  return null;
}

export function getLastPaySlipDate(bps: BpDocumentAiFields[]): Date | null {
  // Filter out entries that have both required fields defined
  const validEntries = bps.filter(bp => bp.fin_periode_paie_date !== null);

  if (validEntries.length === 0) {
    return null;
  }

  // Use reduce to find the entry with the latest fin_periode_emploi
  const lastEntry = validEntries.reduce((latest, bp) => {
    // Since both dates are non-null here, it's safe to compare them
    return latest.fin_periode_paie_date! < bp.fin_periode_paie_date! ? bp : latest;
  });

  return lastEntry.fin_periode_paie_date;
}

export function getEmployeeName(bps: BpDocumentAiFields[]): string | null {
  for (const bp of bps) {
    if (bp.nom_salarie !== null) {
      return bp.nom_salarie;
    }
  }
  return null;
}

export function getEmployeeQualification(bps: BpDocumentAiFields[]): string | null {
  for (const bp of bps) {
    if (bp.employee_qualification !== null) {
      return bp.employee_qualification;
    }
  }
  return null;
}

export function getEmployeeClassificationLevel(bps: BpDocumentAiFields[]): string | null {
  for (const bp of bps) {
    if (bp.employee_classification_level !== null) {
      return bp.employee_classification_level;
    }
  }
  return null;
}

const fetchSuggestions = async (query: string): Promise<{title: string, idcc: string}[] | undefined> => {
  try {
    const response = await fetch(
      `/api/collectiveAgreements/search?query=${encodeURIComponent(query)}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch suggestions");
    }
    const data = await response.json();
    return data.suggestions || [];
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
  }
};

export async function getCollectiveConvention(bps: BpDocumentAiFields[]) {
  for (const bp of bps) {
    if (bp.convention_collective !== null && bp?.convention_collective?.length > 0) {
      const collectiveAgreementSuggestions = await fetchSuggestions(bp.convention_collective);
      if (collectiveAgreementSuggestions && collectiveAgreementSuggestions?.length > 0) {
        return collectiveAgreementSuggestions[0];
      }
    }
  }
}

export function sortBpsByDate(bps: BpAnalysis[]): BpAnalysis[] {
  // Use slice() to avoid mutating the original array.
  return bps.slice().sort((a, b) => {
    // Convert dates to numeric values for comparison.
    // If the date is null, assign it Infinity so that it comes last.
    const timeA = a.debut_periode_paie_date ? a.debut_periode_paie_date.getTime() : Infinity;
    const timeB = b.debut_periode_paie_date ? b.debut_periode_paie_date.getTime() : Infinity;

    return timeA - timeB;
  });
}

export const getSickDays = (bpInfos: BpAnalysis[]) => {
  // Use Object.values to get the array of all values in bpInfos
  // Start with an initial sum of 0
  return Object.values(bpInfos).reduce((sum, field) => {
    const sickDays = field.sickLeaveWorkingDays;
    return sum + (isNaN(sickDays) ? 0 : sickDays); // Ensure to add only valid numbers
  }, 0);
};

export const getUnjustifiedAbsenceDays = (bpInfos: BpAnalysis[]) => {
  return Object.values(bpInfos).reduce((sum, field) => {
    const unjustifiedAbsenceWorkingDays = field.unjustifiedAbsenceWorkingDays;
    return sum + (isNaN(unjustifiedAbsenceWorkingDays) ? 0 : unjustifiedAbsenceWorkingDays);
  }, 0);
};

export const getIclDetailsMessage = (
  referenceSalaryData: FavorableReferenceSalaryCalculationDetails,
  legalSeniorityFormattedDuration: string | null,
  conventionSeniorityFormattedDuration: string | null,
  legalAdvanceNoticeFormattedDuration: string | null,
  conventionAdvanceNoticeFormattedDuration: string | null,
  legalSeniorityWithAdvanceNoticeFormattedDuration: string | null,
  conventionSeniorityWithAdvanceNoticeFormattedDuration: string | null,
  legalIclData: LegalSeverancePayResult,
  conventionIclData: ConventionSeverancePayResult,
  favorableIcl: number,
  isReferenceSalaryFromIclForm: boolean,
) => {
  const referenceSalary12Months = referenceSalaryData.calculationDetails12Months.referenceSalary.toFixed(2);
  const calculationSteps12Months = referenceSalaryData.calculationDetails12Months.calculationSteps;
  const referenceSalary3Months = referenceSalaryData.calculationDetails3Months.referenceSalary.toFixed(2);
  const calculationSteps3Months = referenceSalaryData.calculationDetails3Months.calculationSteps;

  let favorableSalaryMessage: string;
  if (isReferenceSalaryFromIclForm) {
    favorableSalaryMessage = `
Le salaire de référence est de **${referenceSalaryData.referenceSalary}** selon vos modifications. Nous allons retenir celui-ci pour la suite des calculs.`
  } else {
    favorableSalaryMessage = `
- **Méthode 12 derniers mois :** ${calculationSteps12Months} = ${referenceSalary12Months}
- **Méthode 3 derniers mois :** ${calculationSteps3Months} = ${referenceSalary3Months}

${
      referenceSalary12Months > referenceSalary3Months
        ? `Le salaire de référence **${referenceSalary12Months}** est plus favorable car **${referenceSalary12Months} > ${referenceSalary3Months}**. Nous allons retenir celui-ci pour la suite des calculs.`
        : `Le salaire de référence **${referenceSalary3Months}** est plus favorable car **${referenceSalary3Months} > ${referenceSalary12Months}**. Nous allons retenir celui-ci pour la suite des calculs.`
    }
  `.trim();
  }
  const legalSeverancePay = parseFloat(legalIclData.value.toFixed(2));
  const conventionSeverancePay = parseFloat(conventionIclData.value.toFixed(2));

  return `
<u>**1) Calcul du salaire de référence 🤑**</u>
${favorableSalaryMessage}

<u>**2) Détermination du préavis et de l’ancienneté ⏰**</u>

a. **Ancienneté** :

- Ancienneté selon la loi : ${legalSeniorityFormattedDuration ?? "Non trouvé"}
- Ancienneté selon la convention collective : ${conventionSeniorityFormattedDuration ?? "Non trouvé"}

b. **Préavis** :

- Durée du préavis selon la loi : ${legalAdvanceNoticeFormattedDuration ?? "Non trouvé"}
- Durée du préavis selon la convention collective : ${conventionAdvanceNoticeFormattedDuration ?? "Non trouvé"}

c. **Ancienneté + préavis** :

- Ancienneté (loi + préavis légal) : ${legalSeniorityWithAdvanceNoticeFormattedDuration ?? "Non trouvé"}
- Ancienneté (convention + préavis conventionnelle) : ${conventionSeniorityWithAdvanceNoticeFormattedDuration ?? "Non trouvé"}

<u>**3) Détermination de l'Indemnité Compensatrice de Licenciement 💶**</u>

- Selon la loi : ${legalIclData.calculationSteps} = ${legalSeverancePay}
- Selon la <mark>convention collective</mark> : ${conventionIclData.message ?? "Aucune formule"} = ${conventionSeverancePay}

${legalSeverancePay > conventionSeverancePay ? `- Le résultat **${legalSeverancePay}** est le plus favorable car **${legalSeverancePay} > ${conventionSeverancePay}**.` : ""}
${conventionSeverancePay > legalSeverancePay ? `- Le résultat **${conventionSeverancePay}** est le plus favorable car **${conventionSeverancePay} > ${legalSeverancePay}**.` : ""}

**L’ICL est donc de ${favorableIcl.toFixed(2)}€.**
`
}

export const uploadBpFilesToGoogleCloud = (files: File[]) => {
  const uploadPromises = files.map(async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetch("/api/bp/upload", {
        method: "POST",
        body: formData,
      });
    } catch (error) {
      console.error(`Error uploading ${file.name}:`, error);
    }
  });
  Promise.allSettled(uploadPromises).then((results) => {
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`Upload failed for ${files[index].name}:`, result.reason);
      }
    });
  });
};
