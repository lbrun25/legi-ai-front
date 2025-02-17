"use client"
import React, {useCallback, useEffect, useState} from 'react'
import {DragZoneFiles} from "@/components/drag-zone-files";
import UploadedFilesList from "@/components/uploaded-files-list";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import * as Accordion from "@radix-ui/react-accordion";
import {SearchBarAgreements} from "@/components/search-bar-agreements";
import {toast} from "sonner";
import {
  calculateLegalSeverancePay,
  calculateSeniorityWithAbsences,
  compareAdvanceNotice,
  computeEarnedPaidLeave, getAdvanceNoticeNumber,
  getBpName, getCollectiveConvention,
  getEmployeeName,
  getEntryDate,
  getFavorableReferenceSalary,
  getLastPaySlipDate,
  getSeniorityWithAdvanceNotice, getSickDays, getUnjustifiedAbsenceDays,
  processBpInfos,
  processPdfFile,
  sortBpsByDate,
  sumFringeBenefits,
  sumPrimesMontant
} from "@/lib/utils/bp";
import {BpAnalysis, BpDocumentAiFields} from "@/lib/types/bp";
import { max } from 'mathjs';
import ReactMarkdown from "react-markdown";
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import bpAnalysisMock from "@/lib/test/bp";
import rehypeRaw from "rehype-raw";

export default function Page() {
  const [bpFiles, setBpFiles] = useState<File[]>([]);
  const onDropBps = useCallback((acceptedFiles: File[]) => {
    setBpFiles(acceptedFiles);
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bpInfos, setBpInfos] = useState<BpAnalysis[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [entryDate, setEntryDate] = useState<Date | null>(null);
  const [earnedPaidLeave, setEarnedPaidLeave] = useState<number | null>(null);
  const [lastPaySlipDate, setLastPaySlipDate] = useState<Date | null>(null);
  const [currentStep, setCurrentStep] = useState<"extract" | "simulate">("extract");
  const [isEditableInfoVisible, setIsEditableInfoVisible] = useState(false);
  const [severancePay, setSeverancePay] = useState<string | null>(null);
  const [isSimulationFinished, setIsSimulationFinished] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [notificationDate, setNotificationDate] = useState<Date | null>(null);
  const [selectedAgreementSuggestion, setSelectedAgreementSuggestion] = useState<{ title: string; idcc: string } | null>(null);
  const [isSeveranceEligible, setIsSeveranceEligible] = useState<boolean | null>(null);
  const [legalSeveranceEligibilityMessage, setLegalSeveranceEligibilityMessage] = useState("");
  const [conventionSeveranceEligibilityMessage, setConventionSeveranceEligibilityMessage] = useState("");
  const [isLegalSeveranceEligibilityMessageVisible, setIsLegalSeveranceEligibilityMessageVisible] = useState(false);
  const [isConventionSeveranceEligibilityMessageVisible, setIsConventionSeveranceEligibilityMessageVisible] = useState(false);
  const [isSickAfterLastBp, setIsSickAfterLastBp] = useState("")

  const [detailsIcl, setDetailsIcl] = useState<string | null>(null);

  useEffect(() => {
    // TODO: fix default placeholder is new Date() on Safari
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  const handleDeleteFile = (fileToDelete: File) => {
    setBpFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete));
  };

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
      return { value: advanceNoticeData.value, message: advanceNoticeData.message };
    } catch (error) {
      console.error("cannot determine convention advance notice:", error);
      toast.error("Une erreur est survenue lors du calcul du préavis conventionnel.");
    }
  }

  const extractBps = async () => {
    // const results: BpDocumentAiFields[] = bpAnalysisMock;
    const results: BpDocumentAiFields[] = [];

    // Filter to only include PDF files.
    const pdfFiles = bpFiles.filter((file) =>
      file.name.toLowerCase().endsWith(".pdf")
    );
    if (pdfFiles.length === 0) {
      throw new Error("No valid PDF files to process.");
    }

    // Process each PDF file concurrently.
    const processingTasks = pdfFiles.map(async (pdfFile) => {
      try {
        const documentEntities = await processPdfFile(pdfFile);
        if (documentEntities) {
          results.push(documentEntities);
        }
      } catch (error) {
        console.error(`Error processing ${pdfFile.name}:`, error);
      }
    });
    await Promise.all(processingTasks);

    // Process the BP documents to calculate working days, etc.
    const updatedInfos = await processBpInfos(results);
    const sortedResults = sortBpsByDate(updatedInfos);
    setBpInfos(sortedResults);

    // Get and set earned paid leave
    const earnedPaidLeaveBp = computeEarnedPaidLeave(results);
    setEarnedPaidLeave(earnedPaidLeaveBp);

    // Get and set employee info
    const entryDate = getEntryDate(results);
    setEntryDate(entryDate);
    const lastPaySlipDate = getLastPaySlipDate(results);
    setLastPaySlipDate(lastPaySlipDate);
    const employeeName = getEmployeeName(results);
    setEmployeeName(employeeName || "");

    // Set convention if found
    const collectiveConvention = await getCollectiveConvention(results);
    if (collectiveConvention) {
      setSelectedAgreementSuggestion(collectiveConvention);
    }
  }

  const startSimulation = async () => {
    if (!selectedAgreementSuggestion)
      throw new Error("No selected collective agreement.");
    if (notificationDate === null)
      throw new Error("No notification date.");
    if (lastPaySlipDate === null)
      throw new Error("No last pay slip date.");
    if (entryDate === null)
      throw new Error("No entry date.");

    try {
      // 1) Reference Salary Calculation
      const totalSickDays = getSickDays(bpInfos);
      const unjustifiedAbsenceDays = getUnjustifiedAbsenceDays(bpInfos);
      console.log("totalSickDays:", totalSickDays);
      console.log("unjustifiedAbsenceDays:", unjustifiedAbsenceDays);

      const referenceSalaryData = getFavorableReferenceSalary(bpInfos);
      console.log("referenceSalaryData:", referenceSalaryData);

      // 2) Seniority and Advance Notice Calculations
      console.log("lastPaySlipDate:", lastPaySlipDate);
      const legalEndDate =
        isSickAfterLastBp === "OUI" ? lastPaySlipDate : notificationDate;

      console.log("legalEndDate:", legalEndDate);
      console.log("entryDate:", entryDate);
      console.log('unjustifiedAbsenceDays:', unjustifiedAbsenceDays);
      console.log('totalSickDays:', totalSickDays);
      const legalSeniorityData = calculateSeniorityWithAbsences(
        legalEndDate,
        entryDate,
        unjustifiedAbsenceDays + totalSickDays
      );

      console.log("notificationDate:", notificationDate);
      const conventionSeniorityData = calculateSeniorityWithAbsences(
        notificationDate,
        entryDate,
        unjustifiedAbsenceDays
      );

      const legalAdvanceNoticeData = await getLegalAdvanceNotice(
        legalSeniorityData.formatted_duration
      );
      if (!legalAdvanceNoticeData) return;

      const conventionAdvanceNoticeData = await getConventionAdvanceNotice(
        conventionSeniorityData.formatted_duration,
        selectedAgreementSuggestion.idcc
      );
      if (!conventionAdvanceNoticeData) return;

      // const advanceNotice = compareAdvanceNotice(
      //   legalAdvanceNoticeData.value,
      //   conventionAdvanceNoticeData.value
      // );

      const legalSeniorityWithAdvanceNotice = getSeniorityWithAdvanceNotice(
        legalSeniorityData,
        legalAdvanceNoticeData.value
      );
      if (!legalSeniorityWithAdvanceNotice) return;

      const conventionSeniorityWithAdvanceNotice = getSeniorityWithAdvanceNotice(
        conventionSeniorityData,
        conventionAdvanceNoticeData.value
      );
      if (!conventionSeniorityWithAdvanceNotice) return;

      // 3) Indemnity Calculations
      const totalPrimes = sumPrimesMontant(bpInfos);
      const totalFringeBenefits = sumFringeBenefits(bpInfos);
      const conventionRequest = fetch("/api/bp/compute/convention", {
        method: "POST",
        body: JSON.stringify({
          idcc: selectedAgreementSuggestion.idcc,
          referenceSalary: referenceSalaryData.referenceSalary,
          seniority: conventionSeniorityWithAdvanceNotice,
          totalPrimes: totalPrimes,
          totalFringeBenefits: totalFringeBenefits,
        }),
      });
      const [conventionResponse] = await Promise.all([conventionRequest]);
      if (!conventionResponse.ok) {
        console.error("Failed to compute indemnities with the convention");
        return;
      }
      const [conventionData] = await Promise.all([conventionResponse.json()]);

      const legalData = calculateLegalSeverancePay(
        referenceSalaryData.referenceSalary,
        legalSeniorityWithAdvanceNotice
      );
      const legalValue = legalData.value;
      const legalDisplayValue = legalValue.toFixed(2);
      const conventionValue = conventionData.value;
      const conventionDisplayValue = conventionData.value.toFixed(2);

      const favorableIndemnity = max(legalValue, conventionValue);

      // Build the Markdown message as one final template literal.
      const messageSteps = `
<u>**1) Calcul du salaire de référence 🤑**</u>
${referenceSalaryData.calculationSteps}

<u>**2) Détermination du préavis et de l’ancienneté ⏰**</u>

a. **Ancienneté** :

- Ancienneté selon la loi : ${legalSeniorityData.formatted_duration ?? "Non trouvé"}
- Ancienneté selon la convention collective : ${conventionSeniorityData.formatted_duration ?? "Non trouvé"}

b. **Préavis** :

- Durée du préavis selon la loi : ${legalAdvanceNoticeData.message ?? "Non trouvé"}
- Durée du préavis selon la convention collective : ${conventionAdvanceNoticeData.message ?? "Non trouvé"}

c. **Ancienneté + préavis** :

- Ancienneté (loi + préavis légal) : ${legalSeniorityWithAdvanceNotice.formatted_duration ?? "Non trouvé"}
- Ancienneté (convention + préavis conventionnelle) : ${conventionSeniorityWithAdvanceNotice.formatted_duration ?? "Non trouvé"}

<u>**3) Détermination de l'Indemnité Compensatrice de Licenciement 💶**</u>

- Selon la loi : ${legalData.calculationSteps} = ${legalDisplayValue}
- Selon la convention collective : ${conventionData.message ?? "Aucune formule"} = ${conventionDisplayValue}

${legalValue > conventionValue ? `- Le résultat **${legalDisplayValue}** est le plus favorable car **${legalDisplayValue} > ${conventionDisplayValue}**.` : ""}
${conventionValue > legalValue ? `- Le résultat **${conventionDisplayValue}** est le plus favorable car **${conventionDisplayValue} > ${legalDisplayValue}**.` : ""}

**L’ICL est donc de ${favorableIndemnity.toFixed(2)}€.**
`;

      setSeverancePay(`${favorableIndemnity.toFixed(2)}€`);
      setDetailsIcl(messageSteps);
      setIsSimulationFinished(true);
    } catch (error) {
      console.error("Error during simulation:", error);
      toast.error(`Erreur lors de la simulation: ${error}`);
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
        toast.error(`Erreur lors de l'extraction: ${error}`);
      }
    } else if (currentStep === "simulate") {
      try {
        await startSimulation();
      } catch (error) {
        console.error("error during simulation:", error);
        toast.error(`Erreur lors de la simulation: ${error}`);
      }
    }
    setIsProcessing(false);
  }

  const handleSuggestionSelect = (suggestion: { title: string; idcc: string }) => {
    console.log("Selected Suggestion:", suggestion);
    if (suggestion) {
      setSelectedAgreementSuggestion(suggestion);
    }
  };

  // A helper to format a Date as YYYY-MM-DD for the input value.
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    // Ensure month and day are two digits.
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

      {/* List of Uploaded Files */}
      <UploadedFilesList
        files={[...bpFiles]}
        onDeleteFile={handleDeleteFile}
        uploading={false}
        progress={{}}
      />

      {isEditableInfoVisible && (
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
      )}

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
            <label className="block text-sm font-medium text-gray-700">
              Date d'entrée
            </label>
            <DatePicker
              selected={entryDate}
              onChange={(date: Date | null) => setEntryDate(date)}
              dateFormat="dd/MM/yyyy"
              placeholderText="Sélectionnez une date"
              className="pl-4 pr-14 h-12 border border-gray-300 rounded-md"
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
            <label className="block text-sm font-medium text-gray-700">
              Date de notification
            </label>
            <DatePicker
              selected={notificationDate}
              onChange={(date: Date | null) => setNotificationDate(date)}
              dateFormat="dd/MM/yyyy"
              placeholderText="Date de notification"
              className="pl-4 pr-14 h-12 border border-gray-300 rounded-md"
              required
            />
          </div>

          {/* Arrêt après le dernier bulletin de paie */}
          <div>
            <label className="block text-sm font-medium text-gray-700">{"Le salarié a-t-il été en arrêt après le dernier bulletin de paie ?"}</label>
            <select
              name="arreteApresBulletin"
              value={isSickAfterLastBp}
              onChange={(e) => setIsSickAfterLastBp(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">Sélectionnez</option>
              <option value="OUI">OUI</option>
              <option value="NON">NON</option>
            </select>
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
      {/*{isSimulationFinished && (*/}
      {/*  <div className="space-y-4 mt-4 border p-4 rounded-md shadow-md bg-gray-50">*/}
      {/*    <h3 className="font-medium text-lg text-gray-800 mb-2">⚖️ Éligibilité à l'Indemnité</h3>*/}

      {/*    /!* Toggle pour le message légal *!/*/}
      {/*    <div>*/}
      {/*      <div className="flex justify-between items-center cursor-pointer"*/}
      {/*           onClick={() => setIsLegalSeveranceEligibilityMessageVisible(!isLegalSeveranceEligibilityMessageVisible)}>*/}
      {/*        <h4 className="font-medium text-md text-gray-700">Éligibilité Légale</h4>*/}
      {/*        <span>{isLegalSeveranceEligibilityMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isLegalSeveranceEligibilityMessageVisible && (*/}
      {/*        <p*/}
      {/*          className="mt-2 text-gray-600 text-sm border-t pt-2">{legalSeveranceEligibilityMessage || "Aucune donnée disponible."}</p>*/}
      {/*      )}*/}
      {/*    </div>*/}

      {/*    /!* Toggle pour le message conventionnel *!/*/}
      {/*    <div>*/}
      {/*      <div className="flex justify-between items-center cursor-pointer"*/}
      {/*           onClick={() => setIsConventionSeveranceEligibilityMessageVisible(!isConventionSeveranceEligibilityMessageVisible)}>*/}
      {/*        <h4 className="font-medium text-md text-gray-700">Éligibilité Conventionnelle</h4>*/}
      {/*        <span>{isConventionSeveranceEligibilityMessageVisible ? "▲" : "▼"}</span>*/}
      {/*      </div>*/}
      {/*      {isConventionSeveranceEligibilityMessageVisible && (*/}
      {/*        <p*/}
      {/*          className="mt-2 text-gray-600 text-sm border-t pt-2">{conventionSeveranceEligibilityMessage || "Aucune donnée disponible."}</p>*/}
      {/*      )}*/}
      {/*    </div>*/}
      {/*  </div>*/}
      {/*)}*/}

      {/* Display Extracted Fields for Each Pay Slip */}
      {isEditableInfoVisible && (
        <div className="space-y-4 mt-4">
          {bpInfos.map((bp, index) => (
            <div
              key={index}
              className="border p-4 rounded-md shadow-md bg-gray-50"
            >
              <h3 className="font-medium text-lg text-gray-800 mb-2">{getBpName(bp)}</h3>

              {/* Gross Salary Field */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Salaire brut
                </label>
                <Input
                  type="text"
                  name="grossSalary"
                  placeholder="Salaire brut"
                  value={bp.salaire_brut_montant || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = parseFloat(e.target.value || "0");
                    setBpInfos((prevBpInfos) =>
                      prevBpInfos.map((item, i) =>
                        i === index
                          ? { ...item, salaire_brut_montant: updatedValue }
                          : item
                      )
                    );
                  }}
                />
              </div>

              {/* Sick Leave Field */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nombre d'arrêts maladie
                </label>
                <Input
                  type="number"
                  name="sickLeaveWorkingDays"
                  placeholder="0"
                  value={bp.sickLeaveWorkingDays || 0}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = parseFloat(e.target.value);
                    if (isNaN(updatedValue)) {
                      console.warn("Invalid number entered");
                      return;
                    }
                    setBpInfos((prevBpInfos) =>
                      prevBpInfos.map((item, i) =>
                        i === index
                          ? { ...item, sickLeaveWorkingDays: updatedValue }
                          : item
                      )
                    );
                  }}
                />
              </div>

              {/* Primes Field */}
              {bp.primes_montant_valeur && bp.primes_montant_valeur.length > 0 && (
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Primes
                  </label>
                  {bp.primes_montant_valeur.map((prime, primeIndex) => (
                    <Input
                      key={primeIndex}
                      type="number"
                      name={`premium-${primeIndex}`}
                      placeholder="0"
                      value={prime || ""}
                      className="pr-14 h-12"
                      onChange={(e) => {
                        const updatedValue = parseFloat(e.target.value || "0");
                        setBpInfos((prevBpInfos) =>
                          prevBpInfos.map((item, i) => {
                            if (i === index) {
                              return {
                                ...item,
                                primes_montant_valeur: item.primes_montant_valeur.map((p, j) =>
                                  j === primeIndex ? updatedValue : p
                                ),
                              };
                            }
                            return item;
                          })
                        );
                      }}
                    />
                  ))}
                </div>
              )}
              {bp.avantage_en_nature_montant && bp.avantage_en_nature_montant.length > 0 && (
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Avantage en nature
                  </label>
                  {bp.avantage_en_nature_montant.map((advantage, advIndex) => (
                    <Input
                      key={advIndex}
                      type="number"
                      name={`natureAdvantage-${advIndex}`}
                      placeholder="0"
                      value={advantage || ""}
                      className="pr-14 h-12"
                      onChange={(e) => {
                        const updatedValue = parseFloat(e.target.value || "0");
                        setBpInfos((prevBpInfos) =>
                          prevBpInfos.map((item, i) => {
                            if (i === index) {
                              return {
                                ...item,
                                avantage_en_nature_montant: item.avantage_en_nature_montant.map(
                                  (a, j) => (j === advIndex ? updatedValue : a)
                                ),
                              };
                            }
                            return item;
                          })
                        );
                      }}
                    />
                  ))}
                </div>
              )}
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
                <div className="prose prose-sm max-w-none text-gray-800 overflow-auto p-4 bg-white rounded shadow">
                  <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                    {detailsIcl}
                  </ReactMarkdown>
                </div>
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      )}
      {/* Severance Pay Section */}
      {severancePay && (
        <div className="border p-4 rounded-md shadow-md bg-green-50 space-y-4 mt-4">
          <h3 className="font-medium text-lg text-green-800 mb-2">{"💼 ICL"}</h3>
          <p className="text-gray-700 text-lg">
            <strong>Montant : </strong> {severancePay}
          </p>
        </div>
      )}
    </div>
  );
}
