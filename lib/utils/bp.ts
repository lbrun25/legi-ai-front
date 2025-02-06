import {
  BpAnalysis,
  BpDocumentAiFields,
  ReferenceSalaryCalculationDetails,
  SeniorityValueResponse
} from "@/lib/types/bp";
import { max } from "mathjs";
import {extractFirstPageAsBase64} from "@/lib/utils/file";

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
  };

  if (document && document.entities) {
    document.entities.forEach((entity: any) => {
      const { type: type_, mentionText, normalizedValue } = entity;
      const normalizedText = normalizedValue?.text;

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

  const lastThreeMonthsSalaries = validResponses
    .slice(-3)
    .map((response) => response.salaire_brut_montant as number);

  const totalAnnualBonus = bpResponses.reduce((sum, response) => {
    const bonus = response.primes_montant_valeur?.reduce((bonusSum, prime) => bonusSum + prime, 0) || 0;
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

  const favorableSalaryMessage = `
- **Méthode 12 derniers mois :** ${details12Months.calculationSteps} = ${details12Months.referenceSalary.toFixed(2)}
- **Méthode 3 derniers mois :** ${details3Months.calculationSteps} = ${details3Months.referenceSalary.toFixed(2)}

${
    details12Months.referenceSalary > details3Months.referenceSalary
      ? `Le salaire de référence **${details12Months.referenceSalary.toFixed(2)}** est plus favorable car **${details12Months.referenceSalary.toFixed(2)} > ${details3Months.referenceSalary.toFixed(2)}**. Nous allons retenir celui-ci pour la suite des calculs.`
      : `Le salaire de référence **${details3Months.referenceSalary.toFixed(2)}** est plus favorable car **${details3Months.referenceSalary.toFixed(2)} > ${details12Months.referenceSalary.toFixed(2)}**. Nous allons retenir celui-ci pour la suite des calculs.`
  }
  `.trim();

  const favorableReferenceSalary = max(details12Months.referenceSalary, details3Months.referenceSalary);

  return {
    method: "favorable",
    calculationSteps: favorableSalaryMessage,
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
export function calculateSeniority(endDate: Date, startDate: Date): SeniorityValueResponse {
  let totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12;
  totalMonths += endDate.getMonth() - startDate.getMonth();

  if (endDate.getDate() < startDate.getDate()) {
    totalMonths--;
  }

  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;

  const formattedDuration = `${years} ans et ${months} mois`;

  return { total_years: years, total_months: months, formatted_duration: formattedDuration };
}

// Helper function to convert seniority to total days
function seniorityToDays(seniority: SeniorityValueResponse): number {
  const totalYearsInDays = seniority.total_years * 365; // Approximate with 365 days in a year
  const totalMonthsInDays = seniority.total_months * 30; // Approximate with 30 days in a month
  return totalYearsInDays + totalMonthsInDays;
}

// Helper function to convert total days to seniority (years and months)
function daysToSeniority(totalDays: number): SeniorityValueResponse {
  const totalMonths = Math.floor(totalDays / 30); // Convert total days to months
  const years = Math.floor(totalMonths / 12); // Convert months to years
  const months = totalMonths % 12; // Remaining months
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

  // Calculate initial seniority
  const initialSeniority = calculateSeniority(endDate, startDate);

  // Convert seniority to days and subtract absence days
  const totalDays = seniorityToDays(initialSeniority);
  console.log('totalDays:', totalDays)
  const adjustedTotalDays = Math.max(0, totalDays - absenceDays); // Ensure no negative days
  console.log('adjustedTotalDays:', adjustedTotalDays)

  // Convert back to seniority
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
  // Reduce over the array to sum up all values in `nombre_conge_paye` arrays, ignoring null or empty arrays
  return doc.reduce((total, field) => {
    const totalPaidLeave = field.nombre_conge_paye?.reduce((sum, leave) => sum + leave, 0) || 0;
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
      console.log('return doc.sous_total_salaire_base_montant')
      if (doc.absence_non_justifie_periode.length > 0) {
        const totalUnjustifiedAbsence = doc.absences_non_justifiees_montant.reduce((sum, amount) => sum + amount, 0);
        console.log('return brut - totalUnjustifiedAbsence:', brut - totalUnjustifiedAbsence)
        return brut - totalUnjustifiedAbsence;
      }
      console.log('return brut:', brut)
      return brut;
    }
    if (doc.salaire_brut_montant && doc.absences_maladie_montant.length > 0) {
      const totalAbsenceMaladie = doc.absences_maladie_montant.reduce((sum, amount) => sum + amount, 0);
      console.log('return oc.salaire_brut_mensuel - totalAbsenceMaladie:', doc.salaire_brut_montant - totalAbsenceMaladie)
      return doc.salaire_brut_montant - totalAbsenceMaladie;
    }
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
  const validEntries = bps.filter(bp => bp.mois_bulletin_de_paie !== null && bp.fin_periode_paie_date !== null);

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
