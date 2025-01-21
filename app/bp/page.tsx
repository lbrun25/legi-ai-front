"use client"
import React, {useCallback, useEffect, useState} from 'react'
import {DragZoneFiles} from "@/components/drag-zone-files";
import UploadedFilesList from "@/components/uploaded-files-list";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {formatDateToInput} from "@/lib/utils/date";
import * as Accordion from "@radix-ui/react-accordion";
import {SearchBarAgreements} from "@/components/search-bar-agreements";
import {toast} from "sonner";
import {
  getFavorableReferenceSalary,
  parseBpDocumentEntities, removeOverlappingPeriods,
  sumFringeBenefits,
  sumPrimesMontant
} from "@/lib/utils/bp";
import {BpAnalysis, BpDocumentAiFields} from "@/lib/types/bp";
import { max } from 'mathjs';
import ReactMarkdown from "react-markdown";

export default function Page() {
  const [bpFiles, setBpFiles] = useState<File[]>([]);
  const onDropBps = useCallback((acceptedFiles: File[]) => {
    setBpFiles(acceptedFiles);
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bpExtractionResults, setBpExtractionResults] = useState<Record<string, BpDocumentAiFields>>({});
  const [bpFields, setBpFields] = useState<Record<string, BpAnalysis>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [earnedPaidLeave, setEarnedPaidLeave] = useState<number | null>(null);
  const [lastPaySlipDate, setLastPaySlipDate] = useState("");
  const [currentStep, setCurrentStep] = useState<"extract" | "simulate">("extract");
  const [isEditableInfoVisible, setIsEditableInfoVisible] = useState(false);
  const [severancePay, setSeverancePay] = useState<string | null>(null);
  const [isSimulationFinished, setIsSimulationFinished] = useState(false);
  const [isCheckedDataVisible, setIsCheckedDataVisible] = useState(false);
  const [checkedDataMessage, setCheckedDataMessage] = useState<string>("");
  const [isSafari, setIsSafari] = useState(false);
  const [advanceNotice, setAdvanceNotice] = useState<string>("");
  const [notificationDate, setNotificationDate] = useState<string>("");
  const [selectedAgreementSuggestion, setSelectedAgreementSuggestion] = useState<{ title: string; idcc: string } | null>(null);
  const [isSeveranceEligible, setIsSeveranceEligible] = useState<boolean | null>(null);
  const [legalSeveranceEligibilityMessage, setLegalSeveranceEligibilityMessage] = useState("");
  const [conventionSeveranceEligibilityMessage, setConventionSeveranceEligibilityMessage] = useState("");
  const [isLegalSeveranceEligibilityMessageVisible, setIsLegalSeveranceEligibilityMessageVisible] = useState(false);
  const [isConventionSeveranceEligibilityMessageVisible, setIsConventionSeveranceEligibilityMessageVisible] = useState(false);

  // const [legalSeniorityMessage, setLegalSeniorityMessage] = useState("");
  // const [conventionSeniorityMessage, setConventionSeniorityMessage] = useState("");
  // const [favorableSeniorityMessage, setFavorableSeniorityMessage] = useState("");
  // const [isLegalSeniorityMessageVisible, setIsLegalSeniorityMessageVisible] = useState(false);
  // const [isConventionSeniorityMessageVisible, setIsConventionSeniorityMessageVisible] = useState(false);
  // const [isFavorableSeniorityMessageVisible, setIsFavorableSeniorityMessageVisible] = useState(false);
  // const [legalSeniority, setLegalSeniority] = useState("");
  // const [conventionSeniority, setConventionSeniority] = useState("");
  // const [favorableSeniority, setFavorableSeniority] = useState("");

  // const [legalAdvanceNoticeMessage, setLegalAdvanceNoticeMessage] = useState("");
  // const [conventionAdvanceNoticeMessage, setConventionAdvanceNoticeMessage] = useState("");
  // const [legalAdvanceNotice, setLegalAdvanceNotice] = useState("");
  // const [conventionAdvanceNotice, setConventionAdvanceNotice] = useState("");
  // const [isLegalAdvanceNoticeMessageVisible, setIsLegalAdvanceNoticeMessageVisible] = useState(false);
  // const [isConventionAdvanceNoticeMessageVisible, setIsConventionAdvanceNoticeMessageVisible] = useState(false);
  // const [advanceNoticeMessage, setAdvanceNoticeMessage] = useState("");
  // const [isAdvanceNoticeMessageVisible, setIsAdvanceNoticeMessageVisible] = useState(false);

  // const [referenceSalaryMessage, setReferenceSalaryMessage] = useState("");
  const [referenceSalary, setReferenceSalary] = useState<number | null>(null);
  // const [isLegalReferenceSalaryMessageVisible, setIsLegalReferenceSalaryMessageVisible] = useState(false);

  const [detailsIcl, setDetailsIcl] = useState<string | null>(null);

  useEffect(() => {
    // TODO: fix default placeholder is new Date() on Safari
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  const handleDeleteFile = (fileToDelete: File) => {
    setBpFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete));
  };

  const setFieldsForBps = async (results: Record<string, BpDocumentAiFields>) => {
    const updatedFields: Record<string, BpAnalysis> = {};

    const fetchPromises = Object.entries(results).map(async ([fileName, bpResponse]) => {
      if (!bpResponse) {
        return;
      }

      const sickLeavePeriods = bpResponse.periode_arret_maladie || [];
      const unjustifiedAbsencePeriods = bpResponse.absence_non_justifie_periode || [];

      try {
        // Create fetch calls for each sick leave period
        const sickLeaveFetchPromises = sickLeavePeriods.map(async (period) => {
          const payload = { sickLeavePeriod: period };

          const getSickLeaveDaysResponse = await fetch("/api/bp/analysis/getSickLeaveDays", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!getSickLeaveDaysResponse.ok) {
            console.error(`Failed to extract sick leave days for period: ${period} in ${fileName}`);
            return 0; // Default to 0 if the request fails
          }

          const { sickLeaveWorkingDays } = await getSickLeaveDaysResponse.json();
          return sickLeaveWorkingDays || 0;
        });

        // Create fetch calls for each unjustified absence period
        const unjustifiedAbsenceFetchPromises = unjustifiedAbsencePeriods.map(async (period) => {
          const payload = { unjustifiedAbsencePeriod: period };

          const getUnjustifiedAbsenceDaysResponse = await fetch("/api/bp/analysis/getSickLeaveDays", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          });

          if (!getUnjustifiedAbsenceDaysResponse.ok) {
            console.error(`Failed to extract unjustified absence days for period: ${period} in ${fileName}`);
            return 0; // Default to 0 if the request fails
          }

          const { unjustifiedAbsenceWorkingDays } = await getUnjustifiedAbsenceDaysResponse.json();
          return unjustifiedAbsenceWorkingDays || 0;
        });

        // Wait for all fetch calls to complete
        const sickLeaveDaysArray = await Promise.all(sickLeaveFetchPromises);
        const unjustifiedAbsenceDaysArray = await Promise.all(unjustifiedAbsenceFetchPromises);

        // Sum up all sick leave and unjustified absence working days
        const totalSickLeaveWorkingDays = sickLeaveDaysArray.reduce((total, days) => total + days, 0);
        const totalUnjustifiedAbsenceWorkingDays = unjustifiedAbsenceDaysArray.reduce((total, days) => total + days, 0);

        // Update fields with total sick leave and unjustified absence working days
        updatedFields[fileName] = {
          ...bpResponse,
          sickLeaveWorkingDays: totalSickLeaveWorkingDays,
          unjustifiedAbsenceWorkingDays: totalUnjustifiedAbsenceWorkingDays,
        };
      } catch (error) {
        console.error(`Error processing file ${fileName}:`, error);
      }
    });

    // Wait for all fetch requests to complete
    await Promise.all(fetchPromises);
    setBpFields((prevFields) => ({ ...prevFields, ...updatedFields }));
  };

  const checkSeveranceEligibility = async (bpAnalysisResponse: string, idcc: string) => {
    try {
      const severanceEligibilityResponse = await fetch("/api/bp/severanceEligibility", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: bpAnalysisResponse,
          idcc: idcc
        }),
      });
      const severanceEligibilityData = await severanceEligibilityResponse.json();
      setIsSeveranceEligible(severanceEligibilityData.severanceEligibility);
      setLegalSeveranceEligibilityMessage(severanceEligibilityData.legalExplanation);
      setConventionSeveranceEligibilityMessage(severanceEligibilityData.conventionExplanation);
    } catch (error) {
      console.error("cannot determine severance eligibility:", error);
      toast.error("Une erreur est survenue lors de la vérification de l'éligibilité à l'indemnité de licenciement.")
    }
  }

  const getLegalSeniority = async (sickDays: number, unjustifiedAbsenceDays: number) => {
    try {
      const legalSeniorityResponse = await fetch("/api/bp/seniority/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sickDays: sickDays,
          unjustifiedAbsenceDays: unjustifiedAbsenceDays,
          notificationDate: notificationDate,
          entryDate: entryDate,
          lastPaySlip: lastPaySlipDate,
        }),
      });
      const legalSeniorityData = await legalSeniorityResponse.json();
      // setLegalSeniorityMessage(legalSeniorityData.message);
      // setLegalSeniority(legalSeniorityData.value);
      return { value: legalSeniorityData.value, message: legalSeniorityData.message };
    } catch (error) {
      console.error("cannot determine legal seniority:", error);
      toast.error("Une erreur est survenue lors du calcul de l'ancienneté légale.");
    }
  }

  const getConventionSeniority = async (sickDays: number, idcc: string, unjustifiedAbsenceDays: number) => {
    try {
      const conventionSeniorityResponse = await fetch("/api/bp/seniority/convention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sickDays: sickDays,
          unjustifiedAbsenceDays: unjustifiedAbsenceDays,
          idcc: idcc,
          notificationDate: notificationDate,
          entryDate: entryDate,
          lastPaySlip: lastPaySlipDate,
        }),
      });
      const conventionSeniorityData = await conventionSeniorityResponse.json();
      // setConventionSeniorityMessage(conventionSeniorityData.message);
      // setConventionSeniority(conventionSeniorityData.value);
      return { value: conventionSeniorityData.value, message: conventionSeniorityData.message };
    } catch (error) {
      console.error("cannot determine convention seniority:", error);
      toast.error("Une erreur est survenue lors du calcul de l'ancienneté conventionnelle.");
    }
  }


  const getSeniorityWithAdvanceNotice = async (seniority: number, advanceNotice: number) => {
    try {
      const legalSeniorityResponse = await fetch("/api/bp/seniority/sumAdvanceNotice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seniority: seniority,
          advanceNotice: advanceNotice,
        }),
      });
      const legalSeniorityData = await legalSeniorityResponse.json();
      return legalSeniorityData.message;
    } catch (error) {
      console.error("cannot determine the seniority with advance notice:", error);
      toast.error("Une erreur est survenue lors du calcul de l'ancienneté avec le préavis.");
    }
  }

  const getFavorableSeniority = async (legalSeniority: string, conventionSeniority: string) => {
    try {
      const seniorityResponse = await fetch("/api/bp/seniority/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legalSeniority: legalSeniority,
          conventionSeniority: conventionSeniority,
        }),
      });
      const seniorityData = await seniorityResponse.json();
      // setFavorableSeniorityMessage(seniorityData.message);
      // setFavorableSeniority(seniorityData.value);
      return seniorityData.value;
    } catch (error) {
      console.error("cannot determine convention seniority:", error);
      toast.error("Une erreur est survenue lors du calcul de l'ancienneté conventionnelle.");
    }
  }

  const getLegalAdvanceNotice = async (legalSeniority: string) => {
    try {
      const advanceNoticeResponse = await fetch("/api/bp/advanceNotice/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seniority: legalSeniority,
        }),
      });
      const advanceNoticeData = await advanceNoticeResponse.json();
      // setLegalAdvanceNoticeMessage(advanceNoticeData.message);
      // setLegalAdvanceNotice(advanceNoticeData.value);
      return { value: advanceNoticeData.value, message: advanceNoticeData.message };
    } catch (error) {
      console.error("cannot determine legal advance notice:", error);
      toast.error("Une erreur est survenue lors du calcul du préavis légal.");
    }
  }

  const getConventionAdvanceNotice = async (conventionSeniority: string, idcc: string) => {
    try {
      const advanceNoticeResponse = await fetch("/api/bp/advanceNotice/convention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seniority: conventionSeniority,
          idcc: idcc,
        }),
      });
      const advanceNoticeData = await advanceNoticeResponse.json();
      // setConventionAdvanceNoticeMessage(advanceNoticeData.message);
      // setConventionAdvanceNotice(advanceNoticeData.value);
      return { value: advanceNoticeData.value, message: advanceNoticeData.message };
    } catch (error) {
      console.error("cannot determine convention advance notice:", error);
      toast.error("Une erreur est survenue lors du calcul du préavis conventionnel.");
    }
  }

  const getFavorableAdvanceNotice = async (legalAdvanceNotice: string, conventionAdvanceNotice: string) => {
    try {
      const advanceNoticeResponse = await fetch("/api/bp/advanceNotice/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legalAdvanceNotice,
          conventionAdvanceNotice,
        }),
      });
      const advanceNoticeData = await advanceNoticeResponse.json();
      // setAdvanceNotice(advanceNoticeData.value);
      // setAdvanceNoticeMessage(advanceNoticeData.message);
      return advanceNoticeData.value;
    } catch (error) {
      console.error("cannot compare advance notices:", error);
      toast.error("Une erreur est survenue lors du calcul du préavis le plus favorable.");
    }
  }

  const getLegalReferenceSalary = async (bpAnalysisResponse: string) => {
    try {
      const referenceSalaryResponse = await fetch("/api/bp/referenceSalary/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse,
        }),
      });
      const referenceSalaryData = await referenceSalaryResponse.json();
      // setReferenceSalaryMessage(referenceSalaryData.message);
      // setReferenceSalary(referenceSalaryData.value);
      return referenceSalaryData.value;
    } catch (error) {
      console.error("cannot get legal reference salary:", error);
      toast.error("Une erreur est survenue lors du calcul du salaire de référence légal.");
    }
  }

  const getBrutDuringSickLeavePeriod = (doc: BpDocumentAiFields): number | null => {
    console.log('doc.periode_arret_maladie:', doc.periode_arret_maladie)
    if (doc.periode_arret_maladie.length > 0) {
      if (doc.sous_total_salaire_base_montant) {
        console.log('return doc.sous_total_salaire_base_montant')
        if (doc.absence_non_justifie_periode.length > 0) {
          const totalUnjustifiedAbsence = doc.absence_non_justifie_montant.reduce((sum, amount) => sum + amount, 0);
          return doc.sous_total_salaire_base_montant - totalUnjustifiedAbsence;
        }
        return doc.sous_total_salaire_base_montant;
      }
      if (doc.salaire_brut_mensuel && doc.absence_maladie_montant.length > 0) {
        const totalAbsenceMaladie = doc.absence_maladie_montant.reduce((sum, amount) => sum + amount, 0);
        console.log('return oc.salaire_brut_mensuel - totalAbsenceMaladie:', doc.salaire_brut_mensuel - totalAbsenceMaladie)
        return doc.salaire_brut_mensuel - totalAbsenceMaladie;
      }
    }
    return doc.salaire_brut_mensuel;
  };

  const computeEarnedPaidLeave = (doc: BpDocumentAiFields[]): number => {
    // Reduce over the array to sum up all values in `nombre_conge_paye` arrays, ignoring null or empty arrays
    return doc.reduce((total, field) => {
      const totalPaidLeave = field.nombre_conge_paye?.reduce((sum, leave) => sum + leave, 0) || 0;
      return total + totalPaidLeave;
    }, 0);
  };

  const getBpPeriods = (bpResponses: BpDocumentAiFields[]) => {
    const periods: string[] = [];
    for (const doc of bpResponses) {
      if (doc.debut_periode_emploi && doc.fin_periode_emploi) {
        periods.push(`Du ${doc.debut_periode_emploi} au ${doc.fin_periode_emploi}`);
      } else {
        if (doc.mois_bulletin_de_paie) {
          periods.push(doc.mois_bulletin_de_paie);
        }
      }
    }
    return periods;
  }

  const extractBps = async () => {
    if (!selectedAgreementSuggestion) {
      throw new Error("No selected agreement suggestion.");
    }
    const results: Record<string, BpDocumentAiFields> = {};
    const pdfFiles = bpFiles.filter(file => file.name.toLowerCase().endsWith(".pdf"));
    if (pdfFiles.length === 0) {
      throw new Error("No valid PDF files to process.");
    }
    try {
      const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

      const processingTasks = [];
      for (let i = 0; i < pdfFiles.length; i++) {
        processingTasks.push(
          (async () => {
            try {
              // const pdfPages = await convertPdfToImages(pdfFiles[i]);
              // const payload = {
              //   filename: pdfFiles[i].name,
              //   fileBase64: pdfPages[0], // Assume the first page contains the BP
              // };
              // const response = await fetch("/api/bp/analysis", {
              //   method: "POST",
              //   headers: {
              //     "Content-Type": "application/json",
              //   },
              //   body: JSON.stringify(payload),
              // });
              const pdfFile = pdfFiles[i];
              const reader = new FileReader();

              // Wrap the FileReader logic in a promise for async handling
              const encodedFileContent = await new Promise((resolve, reject) => {
                // @ts-ignore
                reader.onload = () => resolve(reader.result.split(',')[1]); // Base64 content
                reader.onerror = reject;
                reader.readAsDataURL(pdfFile); // Read the file as a data URL
              });

              // Make the POST request to the Next.js API route
              const response = await fetch('/api/assistant/files/ocr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encodedFileContent }),
              });

              // Check if the response is successful
              if (!response.ok) {
                throw new Error(`Failed to process PDF: ${response.statusText}`);
              }

              // Get the OCR result from the response
              console.log('response ocr:', response)
              let documentEntities = await parseBpDocumentEntities(response);
              documentEntities = removeOverlappingPeriods(documentEntities);
              console.log('documentEntities:', documentEntities)

              const month = documentEntities.mois_bulletin_de_paie ?? documentEntities.debut_periode_emploi;
              if (!month) {
                console.error(`Failed to process ${pdfFiles[i].name}`);
                return;
              }
              if (documentEntities.absence_maladie_montant || documentEntities.periode_arret_maladie) {
                const brut = parseFloat(getBrutDuringSickLeavePeriod(documentEntities)?.toFixed(2) ?? "0");
                if (brut) {
                  console.log('change brut:',  documentEntities.salaire_brut_mensuel, 'to brut:', brut)
                  documentEntities.salaire_brut_mensuel = brut;
                }
              }
              if (!response.ok) {
                console.error(`Failed to process ${pdfFiles[i].name}`);
              }
              results[month] = documentEntities;
            } catch (error) {
              console.error(`Error processing ${pdfFiles[i].name}:`, error);
              // results[bpDataExtraction.pay_period.month] = `Error processing: ${pdfFiles[i].name}`;
            }
          })()
        );
        await sleep(0);
      }
      await Promise.all(processingTasks);
      // const results = allBpsRecord;
      await setFieldsForBps(results);

      // Get and set earned paid leave
      const earnedPaidLeaveBp = computeEarnedPaidLeave(Object.values(results));
      setEarnedPaidLeave(earnedPaidLeaveBp);

      // Get and set employee info
      const bpAnalysisResponses = Object.values(results);
      const employeeInfoResponse = await fetch("/api/bp/analysis/getEmployeeInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entryDate: bpAnalysisResponses[0].date_entree_entreprise,
          bpPeriods: getBpPeriods(bpAnalysisResponses),
        }),
      });
      if (!employeeInfoResponse.ok) {
        console.error(`Failed to compute legal indemnities`);
        return;
      }
      const employeeInfoData = await employeeInfoResponse.json();
      setEntryDate(formatDateToInput(employeeInfoData.entryDate) || "");
      setLastPaySlipDate(employeeInfoData.lastPaySlipDate || "");
      console.log('employeeInfoData:', employeeInfoData)
      setEmployeeName(bpAnalysisResponses[0].nom_salarie || "");
    } catch (error) {
      console.error("Error during extraction:", error);
      throw error;
    } finally {
      setBpExtractionResults(results);
    }
  }

  const getSickDays = () => {
     // Use Object.values to get the array of all values in bpFields
     // Start with an initial sum of 0
    return Object.values(bpFields).reduce((sum, field) => {
      const sickDays = field.sickLeaveWorkingDays;
      return sum + (isNaN(sickDays) ? 0 : sickDays); // Ensure to add only valid numbers
    }, 0);
  };

  const getUnjustifiedAbsenceDays = () => {
    return Object.values(bpFields).reduce((sum, field) => {
      const unjustifiedAbsenceWorkingDays = field.unjustifiedAbsenceWorkingDays;
      return sum + (isNaN(unjustifiedAbsenceWorkingDays) ? 0 : unjustifiedAbsenceWorkingDays);
    }, 0);
  };

  const startSimulation = async () => {
    // TODO: ANCIENNETÉ: ne pas additioner larret maladie
    // TODO: salaire de reference: additionner au brut l'arret maladie
    if (!selectedAgreementSuggestion) {
      throw new Error("No selected agreement suggestion.");
    }
    try {
      const bpAnalysisResponses = Object.values(bpFields);
      // TODO: check eligibility
      // await checkSeveranceEligibility(concatenatedBpStr, selectedAgreementSuggestion.idcc);

      // TODO: check if the date of the end last pay slip. Be careful if we do not have bp that means it's sick period

      let messageSteps = "";

      const totalSickDays = getSickDays();
      const unjustifiedAbsenceDays = getUnjustifiedAbsenceDays();
      console.log('totalSickDays:', totalSickDays);
      console.log('unjustifiedAbsenceDays:', unjustifiedAbsenceDays);

      const referenceSalaryData = getFavorableReferenceSalary(bpAnalysisResponses);
      setReferenceSalary(referenceSalaryData.referenceSalary);
      console.log('referenceSalaryData:', referenceSalaryData);
      messageSteps += referenceSalaryData.calculationSteps;

      // Use entry date
      // Use last pay slip
      // use sick days and unjustified absence

      messageSteps += "   \n2) Détermination du préavis et de l’ancienneté ⏰:  \n"
      const legalSeniorityData = await getLegalSeniority(totalSickDays, unjustifiedAbsenceDays);
      if (!legalSeniorityData) return;
      messageSteps += "a. Ancienneté :  \n• "
      messageSteps += legalSeniorityData.message ?? "Ancienneté selon la loi : Non trouvé";

      const conventionSeniorityData = await getConventionSeniority(totalSickDays, selectedAgreementSuggestion.idcc, unjustifiedAbsenceDays);
      if (!conventionSeniorityData) return;
      messageSteps += "\n• "
      messageSteps += conventionSeniorityData.message ?? "Ancienneté selon la convention collective : Non trouvé";

      const legalAdvanceNoticeData = await getLegalAdvanceNotice(legalSeniorityData.value);
      if (!legalAdvanceNoticeData) return;
      messageSteps += "  \nb. Préavis :  \n• "
      messageSteps += legalAdvanceNoticeData.message ?? "- Durée du préavis selon la loi : Non trouvé";

      const conventionAdvanceNoticeData = await getConventionAdvanceNotice(conventionSeniorityData.value, selectedAgreementSuggestion.idcc);
      if (!conventionAdvanceNoticeData) return;
      messageSteps += "\n• "
      messageSteps += conventionAdvanceNoticeData.message ?? "- Durée du préavis selon la convention collective : Non trouvé";

      console.log('messageSteps:', messageSteps)

      const legalSeniorityWithAdvanceNotice = await getSeniorityWithAdvanceNotice(legalSeniorityData.value, legalAdvanceNoticeData.value);
      messageSteps += "  \nc. Ancienneté + préavis :  \n"
      messageSteps += "• Ancienneté selon la loi (incluant préavis) : ancienneté légale + préavis légal : ";
      messageSteps += legalSeniorityWithAdvanceNotice ?? "Non trouvé";

      const conventionSeniorityWithAdvanceNotice = await getSeniorityWithAdvanceNotice(conventionSeniorityData.value, conventionAdvanceNoticeData.value);
      if (!conventionSeniorityWithAdvanceNotice) return;
      messageSteps += "  \n• Ancienneté selon la convention collective (incluant préavis) : ";
      messageSteps += conventionSeniorityWithAdvanceNotice ?? "Non trouvé";


      // TODO: need favorable  advance notice ?
      // const advanceNotice = await getFavorableAdvanceNotice(legalAdvanceNoticeData.value, conventionAdvanceNoticeData.value);

      // Parallel API Calls: /compute/legal and /compute/convention
      // TODO: check if seniority should be favorableSeniority
      const legalRequest = fetch("/api/bp/compute/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          referenceSalary: referenceSalaryData.referenceSalary,
          seniority: legalSeniorityData.value,
        }),
      });

      const totalPrimes = sumPrimesMontant(bpAnalysisResponses);
      const totalFringeBenefits = sumFringeBenefits(bpAnalysisResponses);
      const conventionRequest = fetch("/api/bp/compute/convention", {
        method: "POST",
        body: JSON.stringify({
          idcc: selectedAgreementSuggestion.idcc,
          referenceSalary: referenceSalaryData.referenceSalary,
          seniority: conventionSeniorityData.value,
          totalPrimes: totalPrimes,
          totalFringeBenefits: totalFringeBenefits,
        }),
      });

      const [legalResponse, conventionResponse] = await Promise.all([
        legalRequest,
        conventionRequest,
      ]);
      if (!legalResponse.ok) {
        console.error(`Failed to compute legal indemnities`);
        return;
      }
      if (!conventionResponse.ok) {
        console.error(`Failed to compute indemnities with the convention`);
        return;
      }

      const [legalData, conventionData] = await Promise.all([
        legalResponse.json(),
        conventionResponse.json(),
      ]);

      messageSteps += "   \n3. Détermination de Indemnité Compensatrice de Licenciement 💶:  \n"
      messageSteps += legalData.message;
      messageSteps += "   \n";
      messageSteps += conventionData.message;

      console.log('legalData.value:', legalData.value)
      console.log('conventionData.value:', conventionData.value)
      const legalValue = parseFloat(legalData.value);
      const conventionValue = parseFloat(conventionData.value);
      if (legalValue > conventionValue)
        messageSteps += `Le résultat ${legalValue} est le plus favorable car ${legalValue} > ${conventionValue}.\n`;
      if (conventionValue > legalValue)
        messageSteps +=  `Le résultat ${conventionValue} est le plus favorable car ${conventionValue} > ${legalValue}.\n`;

      const favorableIndemnity = max(legalValue, conventionValue);
      setSeverancePay(`${favorableIndemnity.toString()}€`);
      messageSteps += `\nL’ICL est donc de ${favorableIndemnity.toString()}€.\n`;
      setDetailsIcl(messageSteps);

      // // Check response
      // const checkResponse = await fetch("/api/bp/check", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     legalIndemnitiesResponse: legalData.message,
      //     conventionIndemnitiesResponse: conventionData.message
      //   }),
      // });
      // if (!checkResponse.ok) {
      //   console.error(`Failed to check indemnities`);
      //   return;
      // }
      // const checkedData = await checkResponse.json();
      // setCheckedDataMessage(checkedData.message);

      // const compareResponse = await fetch("/api/bp/compute/compare", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     checkedResponse: checkedData.message
      //   }),
      // });
      // if (!compareResponse.ok) {
      //   console.error(`Failed to compare indemnities`);
      //   return;
      // }
      // const compareData = await compareResponse.json();
      // setSeverancePay(compareData.severancePay || "Non spécifié");

      setIsSimulationFinished(true);

      // const cpResponse = await fetch("/api/bp/compute/cp", {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({bpAnalysisResponse: concatenatedBpStr}),
      // });
      // if (!cpResponse.ok) {
      //   console.error(`Failed to compute CP indemnities`);
      //   return;
      // }
      // const cpData = await cpResponse.json();
    } catch (error) {
      console.error("Error during simulation:", error);
    }
  };

  const onButtonClicked = async () => {
    setIsProcessing(true);
    if (currentStep === "extract") {
      try {
        await extractBps();
        console.log('extractBps finished')
        setIsEditableInfoVisible(true);
        setCurrentStep("simulate");
      } catch (error) {
        console.error("error during extraction:", error);
      }
    } else if (currentStep === "simulate") {
      try {
        await startSimulation();
      } catch (error) {
        console.error("error during simulation:", error);
      }
    }
    setIsProcessing(false);
  }

  const handleSuggestionSelect = (suggestion: { title: string; idcc: string }) => {
    setSelectedAgreementSuggestion(suggestion);
    console.log("Selected Suggestion:", suggestion);
  };

  const toggleCheckedDataVisibility = () => {
    setIsCheckedDataVisible((prev) => !prev);
  };

  return (
    <div className="flex flex-col w-full max-w-prose py-24 mx-auto space-y-6">
      {/* Pay Slips Drag Zone */}
      <DragZoneFiles
        onDrop={onDropBps}
        dragActiveLabel="Déposez vos bulletins de salaire ici..."
        label={(
          <p className="text-gray-600">
            {"Glisser-déposer de 1 à 12 fiches de paie ici, ou "}
            <span className="text-blue-500 font-medium underline">{"cliquez"}</span>{" "}
            {"pour sélectionner les fichiers."}
          </p>
        )}
      />

      <div
        className="flex flex-col w-full max-w-prose py-8 mx-auto space-y-6 rounded-3xl bg-gray-50 dark:bg-gray-900 px-8">
        <h2 className="text-lg font-medium">{"🔍 Rechercher une Convention Collective"}</h2>
        <SearchBarAgreements onSelect={handleSuggestionSelect}/>
        {selectedAgreementSuggestion && (
          <div
            className="text-sm mt-4 p-4 border border-gray-200 rounded-lg bg-white shadow-sm dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-1">
              {"Convention collective sélectionnée:"}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              <strong>IDCC:</strong> {selectedAgreementSuggestion.idcc}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              <strong>Titre:</strong> {selectedAgreementSuggestion.title}
            </p>
          </div>
        )}
      </div>

      {/* List of Uploaded Files */}
      <UploadedFilesList
        files={[...bpFiles]}
        onDeleteFile={handleDeleteFile}
        uploading={false}
        progress={{}}
      />

      {/* Employee Information Section */}
      {isEditableInfoVisible && (
        <div className="border p-4 rounded-md shadow-md bg-gray-50 space-y-4 mt-4">
          <h3 className="font-medium text-lg text-gray-800 mb-2">{"👤 Informations salarié"}</h3>

          {/* Employee Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <Input
              type="text"
              name="employeeName"
              placeholder="Nom"
              value={employeeName}
              onChange={(e) => setEmployeeName(e.target.value)}
              className="pr-14 h-12"
            />
          </div>

          {/* Entry Date Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{"Date d'entrée"}</label>
            <Input
              type="date"
              name="entryDate"
              placeholder="Date d'entrée"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="pr-14 h-12"
            />
          </div>

          {/* Earned Paid Leave Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{"Congés payés acquis à date"}</label>
            <Input
              type="number"
              name="earnedPaidLeave"
              placeholder=""
              value={earnedPaidLeave ?? 0}
              onChange={(e) => setEarnedPaidLeave(Number(e.target.value))}
              className="pr-14 h-12"
            />
          </div>

          {/* Date de notification */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{"Date de notification"}</label>
            <Input
              type="date"
              name="notificationDate"
              placeholder="Date de notification"
              value={notificationDate}
              onChange={(e) => setNotificationDate(e.target.value)}
              className="pr-14 h-12"
            />
          </div>

          {/* Période de sortie */}
          {/*<div>*/}
          {/*  <label className="block text-sm font-medium text-gray-700">{"Préavis"}</label>*/}
          {/*  <Input*/}
          {/*    type="text"*/}
          {/*    name="advanceNotice"*/}
          {/*    placeholder="2 mois"*/}
          {/*    value={advanceNotice}*/}
          {/*    onChange={(e) => setAdvanceNotice(e.target.value)}*/}
          {/*    className="pr-14 h-12"*/}
          {/*  />*/}
          {/*</div>*/}
        </div>
      )}

      {/* Section pour les messages d'éligibilité */}
      {isSimulationFinished && (
        <div className="space-y-4 mt-4 border p-4 rounded-md shadow-md bg-gray-50">
          <h3 className="font-medium text-lg text-gray-800 mb-2">⚖️ Éligibilité à l'Indemnité</h3>

          {/* Toggle pour le message légal */}
          <div>
            <div className="flex justify-between items-center cursor-pointer"
                 onClick={() => setIsLegalSeveranceEligibilityMessageVisible(!isLegalSeveranceEligibilityMessageVisible)}>
              <h4 className="font-medium text-md text-gray-700">Éligibilité Légale</h4>
              <span>{isLegalSeveranceEligibilityMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isLegalSeveranceEligibilityMessageVisible && (
              <p
                className="mt-2 text-gray-600 text-sm border-t pt-2">{legalSeveranceEligibilityMessage || "Aucune donnée disponible."}</p>
            )}
          </div>

          {/* Toggle pour le message conventionnel */}
          <div>
            <div className="flex justify-between items-center cursor-pointer"
                 onClick={() => setIsConventionSeveranceEligibilityMessageVisible(!isConventionSeveranceEligibilityMessageVisible)}>
              <h4 className="font-medium text-md text-gray-700">Éligibilité Conventionnelle</h4>
              <span>{isConventionSeveranceEligibilityMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isConventionSeveranceEligibilityMessageVisible && (
              <p
                className="mt-2 text-gray-600 text-sm border-t pt-2">{conventionSeveranceEligibilityMessage || "Aucune donnée disponible."}</p>
            )}
          </div>
        </div>
      )}

      {/* Section pour afficher les messages supplémentaires */}
      {/*{isSimulationFinished && (*/}
      {/*  <div className="space-y-6 mt-4 border p-4 rounded-md shadow-md bg-gray-50">*/}
      {/*    <h3 className="font-medium text-lg text-gray-800 mb-4">📄 Résultats et Calculs</h3>*/}

      {/*    /!* Messages d'ancienneté *!/*/}
      {/*    <div>*/}
      {/*      <div*/}
      {/*        className="flex justify-between items-center cursor-pointer"*/}
      {/*        onClick={() => setIsLegalSeniorityMessageVisible(!isLegalSeniorityMessageVisible)}*/}
      {/*      >*/}
      {/*        <h4 className="font-medium text-md text-gray-700">{`Ancienneté Légale: ${legalSeniority}`}</h4>*/}
      {/*        <span>{isLegalSeniorityMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isLegalSeniorityMessageVisible && (*/}
      {/*        <p className="mt-2 text-gray-600 text-sm border-t pt-2">*/}
      {/*          {legalSeniorityMessage || "Aucune donnée disponible."}*/}
      {/*        </p>*/}
      {/*      )}*/}
      {/*    </div>*/}

      {/*    <div>*/}
      {/*      <div*/}
      {/*        className="flex justify-between items-center cursor-pointer"*/}
      {/*        onClick={() => setIsConventionSeniorityMessageVisible(!isConventionSeniorityMessageVisible)}*/}
      {/*      >*/}
      {/*        <h4 className="font-medium text-md text-gray-700">{`Ancienneté Conventionnelle: ${conventionSeniority}`}</h4>*/}
      {/*        <span>{isConventionSeniorityMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isConventionSeniorityMessageVisible && (*/}
      {/*        <p className="mt-2 text-gray-600 text-sm border-t pt-2">*/}
      {/*          {conventionSeniorityMessage || "Aucune donnée disponible."}*/}
      {/*        </p>*/}
      {/*      )}*/}
      {/*    </div>*/}

      {/*    /!* Messages de préavis *!/*/}
      {/*    <div>*/}
      {/*      <div*/}
      {/*        className="flex justify-between items-center cursor-pointer"*/}
      {/*        onClick={() => setIsLegalAdvanceNoticeMessageVisible(!isLegalAdvanceNoticeMessageVisible)}*/}
      {/*      >*/}
      {/*        <h4 className="font-medium text-md text-gray-700">{`Préavis Légal: ${legalAdvanceNotice}`}</h4>*/}
      {/*        <span>{isLegalAdvanceNoticeMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isLegalAdvanceNoticeMessageVisible && (*/}
      {/*        <p className="mt-2 text-gray-600 text-sm border-t pt-2">*/}
      {/*          {legalAdvanceNoticeMessage || "Aucune donnée disponible."}*/}
      {/*        </p>*/}
      {/*      )}*/}
      {/*    </div>*/}

      {/*    <div>*/}
      {/*      <div*/}
      {/*        className="flex justify-between items-center cursor-pointer"*/}
      {/*        onClick={() => setIsConventionAdvanceNoticeMessageVisible(!isConventionAdvanceNoticeMessageVisible)}*/}
      {/*      >*/}
      {/*        <h4 className="font-medium text-md text-gray-700">{`Préavis Conventionnel: ${conventionAdvanceNotice}`}</h4>*/}
      {/*        <span>{isConventionAdvanceNoticeMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isConventionAdvanceNoticeMessageVisible && (*/}
      {/*        <p className="mt-2 text-gray-600 text-sm border-t pt-2">*/}
      {/*          {conventionAdvanceNoticeMessage || "Aucune donnée disponible."}*/}
      {/*        </p>*/}
      {/*      )}*/}
      {/*    </div>*/}

      {/*    <div>*/}
      {/*      <div*/}
      {/*        className="flex justify-between items-center cursor-pointer"*/}
      {/*        onClick={() => setIsAdvanceNoticeMessageVisible(!isAdvanceNoticeMessageVisible)}*/}
      {/*      >*/}
      {/*        <h4 className="font-medium text-md text-gray-700">{`Préavis Favorable: ${advanceNotice}`}</h4>*/}
      {/*        <span>{isAdvanceNoticeMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isAdvanceNoticeMessageVisible && (*/}
      {/*        <p className="mt-2 text-gray-600 text-sm border-t pt-2">*/}
      {/*          {advanceNoticeMessage || "Aucune donnée disponible."}*/}
      {/*        </p>*/}
      {/*      )}*/}
      {/*    </div>*/}

      {/*    /!* Messages de salaire de référence *!/*/}
      {/*    <div>*/}
      {/*      <div*/}
      {/*        className="flex justify-between items-center cursor-pointer"*/}
      {/*        onClick={() => setIsLegalReferenceSalaryMessageVisible(!isLegalReferenceSalaryMessageVisible)}*/}
      {/*      >*/}
      {/*        <h4 className="font-medium text-md text-gray-700">{`Salaire de Référence: ${referenceSalary}`}</h4>*/}
      {/*        <span>{isLegalReferenceSalaryMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isLegalReferenceSalaryMessageVisible && (*/}
      {/*        <p className="mt-2 text-gray-600 text-sm border-t pt-2">*/}
      {/*          {referenceSalaryMessage || "Aucune donnée disponible."}*/}
      {/*        </p>*/}
      {/*      )}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}


      {/* Display Extracted Fields for Each Pay Slip */}
      {isEditableInfoVisible && (
        <div className="space-y-4 mt-4">
          {Object.entries(bpFields).map(([key, value]) => (
            <div
              key={key}
              className="border p-4 rounded-md shadow-md bg-gray-50"
            >
              <h3 className="font-medium text-lg text-gray-800 mb-2">{key}</h3>

              {/* Gross Salary Field */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">{"Salaire brut"}</label>
                <Input
                  type="text"
                  name="grossSalary"
                  placeholder="Salaire brut"
                  value={bpFields[key]?.salaire_brut_mensuel || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = parseFloat(e.target.value || "0");
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [key]: {
                        ...prevFields[key],
                        salaire_brut_mensuel: updatedValue,
                      },
                    }));
                  }}
                />
              </div>

              {/* Pay Period Field */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">{"Période de paie"}</label>
                <Input
                  type="text"
                  name="payPeriod"
                  placeholder="Période de paie"
                  value={`Du ${bpFields[key]?.debut_periode_emploi} au ${bpFields[key]?.fin_periode_emploi}`}
                  className="pr-14 h-12"
                  disabled
                  onChange={(e) => {
                    const updatedValue = parseFloat(e.target.value || "0");
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [key]: {
                        ...prevFields[key],
                        period: updatedValue,
                      },
                    }));
                  }}
                />
              </div>

              {/* Sick leave Field */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">{"Nombre d'arrêts maladie"}</label>
                <Input
                  type="number"
                  name="sickLeaveWorkingDays"
                  placeholder="0"
                  value={bpFields[key]?.sickLeaveWorkingDays || 0}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = parseFloat(e.target.value); // Convert to a floating-point number
                    if (isNaN(updatedValue)) {
                      console.warn("Invalid number entered");
                      return;
                    }
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [key]: {
                        ...prevFields[key],
                        sickLeaveWorkingDays: updatedValue,
                      },
                    }));
                  }}
                />
              </div>

              {/* Primes Field */}
              {bpFields[key]?.primes_montant?.length > 0 && (
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">{"Primes"}</label>
                  {bpFields[key]?.primes_montant.map((prime, index) => (
                    <Input
                      key={index}
                      type="number"
                      name={`premium-${index}`}
                      placeholder="0"
                      value={prime || ""}
                      className="pr-14 h-12"
                      onChange={(e) => {
                        const updatedValue = parseFloat(e.target.value || "0");
                        setBpFields((prevFields) => ({
                          ...prevFields,
                          [key]: {
                            ...prevFields[key],
                            primes_montant: prevFields[key].primes_montant.map((p, i) =>
                              i === index ? updatedValue : p
                            ),
                          },
                        }));
                      }}
                    />
                  ))}
                </div>
              )}

              {/*<div>*/}
              {/*  <label className="block text-sm font-medium text-gray-700">{"Avantage en nature"}</label>*/}
              {/*  <Input*/}
              {/*    type="text"*/}
              {/*    name="natureAdvantage"*/}
              {/*    placeholder=""*/}
              {/*    value={bpFields[key]?.natureAdvantage || ""}*/}
              {/*    className="pr-14 h-12"*/}
              {/*    onChange={(e) => {*/}
              {/*      const updatedValue = e.target.value;*/}
              {/*      setBpFields((prevFields) => ({*/}
              {/*        ...prevFields,*/}
              {/*        [key]: {*/}
              {/*          ...prevFields[key],*/}
              {/*          natureAdvantage: updatedValue,*/}
              {/*        },*/}
              {/*      }));*/}
              {/*    }}*/}
              {/*  />*/}
              {/*</div>*/}
            </div>
          ))}
        </div>
      )}

      {isSeveranceEligible === false && (
        <div className="border p-4 rounded-md shadow-md bg-red-50 text-red-800 space-y-2 mt-4">
          <h3 className="font-medium text-lg">{"❌ Non Éligible"}</h3>
          <p>{"Le salarié n'est pas éligible à une indemnité de licenciement."}</p>
        </div>
      )}

      {/* Start Simulation Button */}
      {!isSimulationFinished && (
        <Button
          variant="default"
          onClick={onButtonClicked}
          disabled={isProcessing || bpFiles.length === 0 || isSeveranceEligible === false}
        >
          {isProcessing
            ? currentStep === "extract"
              ? "Extraction en cours..."
              : "Simulation en cours..."
            : currentStep === "extract"
              ? "Suivant"
              : "Calculer"}
        </Button>
      )}
      {/* Accordéon pour afficher les détails de vérification */}
      {isSimulationFinished && (
        <Accordion.Root type="single" collapsible>
          <Accordion.Item value="checkedDataDetails">
            <Accordion.Header>
              <Accordion.Trigger
                className="flex justify-between items-center w-full py-2 px-4 border rounded-md bg-gray-50 hover:bg-gray-100">
                📝 Afficher les détails
                <span>▼</span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content>
              <div className="mt-2 p-4 border rounded-md bg-gray-100">
                <h4 className="text-md font-medium mb-2">📝 Détails</h4>
                <ReactMarkdown
                  className="text-sm text-gray-800 overflow-auto"
                >
                  {detailsIcl}
                </ReactMarkdown>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )}
      {/* Severance Pay Section */}
      {severancePay && (
        <div className="border p-4 rounded-md shadow-md bg-green-50 space-y-4 mt-4">
          <h3 className="font-medium text-lg text-green-800 mb-2">{"💼 Indemnité de Licenciement"}</h3>
          <p className="text-gray-700 text-lg">
            <strong>Montant : </strong> {severancePay}
          </p>
        </div>
      )}
    </div>
  );
}
