"use client"
import React, {useCallback, useEffect, useState} from 'react'
import {DragZoneFiles} from "@/components/drag-zone-files";
import UploadedFilesList from "@/components/uploaded-files-list";
import {Button} from "@/components/ui/button";
import {convertPdfToImages} from "@/lib/utils/file";
import {Input} from "@/components/ui/input";
import {formatDateToInput} from "@/lib/utils/date";
import * as Accordion from "@radix-ui/react-accordion";
import {SearchBarAgreements} from "@/components/search-bar-agreements";
import {toast} from "sonner";
import {allBps, allBpsRecord} from "@/lib/test/bp";

export default function Page() {
  const [bpFiles, setBpFiles] = useState<File[]>([]);
  const onDropBps = useCallback((acceptedFiles: File[]) => {
    setBpFiles(acceptedFiles);
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bpExtractionResults, setBpExtractionResults] = useState<Record<string, string>>({});
  const [bpFields, setBpFields] = useState<Record<string, { brut?: string; period?: string; sickLeaveWorkingDays?: string; premiums?: string; }>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [earnedPaidLeave, setEarnedPaidLeave] = useState("");
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

  const [legalSeniorityMessage, setLegalSeniorityMessage] = useState("");
  const [conventionSeniorityMessage, setConventionSeniorityMessage] = useState("");
  const [isLegalSeniorityMessageVisible, setIsLegalSeniorityMessageVisible] = useState(false);
  const [isConventionSeniorityMessageVisible, setIsConventionSeniorityMessageVisible] = useState(false);
  const [legalSeniority, setLegalSeniority] = useState("");
  const [conventionSeniority, setConventionSeniority] = useState("");

  const [legalAdvanceNoticeMessage, setLegalAdvanceNoticeMessage] = useState("");
  const [conventionAdvanceNoticeMessage, setConventionAdvanceNoticeMessage] = useState("");
  const [legalAdvanceNotice, setLegalAdvanceNotice] = useState("");
  const [conventionAdvanceNotice, setConventionAdvanceNotice] = useState("");
  const [isLegalAdvanceNoticeMessageVisible, setIsLegalAdvanceNoticeMessageVisible] = useState(false);
  const [isConventionAdvanceNoticeMessageVisible, setIsConventionAdvanceNoticeMessageVisible] = useState(false);
  const [advanceNoticeMessage, setAdvanceNoticeMessage] = useState("");
  const [isAdvanceNoticeMessageVisible, setIsAdvanceNoticeMessageVisible] = useState(false);

  const [legalReferenceSalaryMessage, setLegalReferenceSalaryMessage] = useState("");
  const [conventionReferenceSalaryMessage, setConventionReferenceSalaryMessage] = useState("");
  const [legalReferenceSalary, setLegalReferenceSalary] = useState("");
  const [conventionReferenceSalary, setConventionReferenceSalary] = useState("");
  const [favorableReferenceSalaryMessage, setFavorableReferenceSalaryMessage] = useState("");
  const [referenceSalary, setReferenceSalary] = useState("");
  const [isLegalReferenceSalaryMessageVisible, setIsLegalReferenceSalaryMessageVisible] = useState(false);
  const [isConventionReferenceSalaryMessageVisible, setIsConventionReferenceSalaryMessageVisible] = useState(false);
  const [isFavorableReferenceSalaryMessageVisible, setIsFavorableReferenceSalaryMessageVisible] = useState(false);

  useEffect(() => {
    // TODO: fix default placeholder is new Date() on Safari
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  const handleDeleteFile = (fileToDelete: File) => {
    setBpFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete));
  };

  const setFieldsForBps = async (results: Record<string, string>) => {
    const updatedFields: Record<string, { brut?: string; period?: string; sickLeaveWorkingDays?: string; premiums?: string; }> = {};

    for (const [fileName, bpResponse] of Object.entries(results)) {
      if (bpResponse.startsWith("Error")) {
        console.error(`Skipping ${fileName} due to error: ${bpResponse}`);
        continue;
      }

      try {
        const payload = {
          bpResponse, // Pass the bpResponse directly
        };

        const getBrutFromBpResponse = await fetch("/api/bp/analysis/getBrut", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!getBrutFromBpResponse.ok) {
          console.error(`Failed to extract brut from ${fileName}`);
          continue;
        }

        const { brut, period, sickLeaveWorkingDays, premiums } = await getBrutFromBpResponse.json();
        updatedFields[fileName] = { brut, period, sickLeaveWorkingDays, premiums };
        console.log('fileName:', fileName)
      } catch (error) {
        console.error(`Error extracting data from ${fileName}:`, error);
      }
    }
    console.log("Updated fields: ", updatedFields);
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

  const getLegalSeniority = async (bpAnalysisResponse: string) => {
    try {
      const legalSeniorityResponse = await fetch("/api/bp/seniority/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: bpAnalysisResponse,
          notificationDate: notificationDate,
          entryDate: entryDate,
        }),
      });
      const legalSeniorityData = await legalSeniorityResponse.json();
      setLegalSeniorityMessage(legalSeniorityData.message);
      setLegalSeniority(legalSeniorityData.value);
    } catch (error) {
      console.error("cannot determine legal seniority:", error);
      toast.error("Une erreur est survenue lors du calcul de l'ancienneté légale.");
    }
  }

  const getConventionSeniority = async (bpAnalysisResponse: string, idcc: string) => {
    try {
      const conventionSeniorityResponse = await fetch("/api/bp/seniority/convention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: bpAnalysisResponse,
          idcc: idcc,
          notificationDate: notificationDate,
          entryDate: entryDate,
        }),
      });
      const conventionSeniorityData = await conventionSeniorityResponse.json();
      setConventionSeniorityMessage(conventionSeniorityData.message);
      setConventionSeniority(conventionSeniorityData.value);
    } catch (error) {
      console.error("cannot determine convention seniority:", error);
      toast.error("Une erreur est survenue lors du calcul de l'ancienneté conventionnelle.");
    }
  }

  const getLegalAdvanceNotice = async (bpAnalysisResponse: string, legalSeniority: string) => {
    try {
      const advanceNoticeResponse = await fetch("/api/bp/advanceNotice/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: bpAnalysisResponse,
          seniority: legalSeniority,
        }),
      });
      const advanceNoticeData = await advanceNoticeResponse.json();
      setLegalAdvanceNoticeMessage(advanceNoticeData.message);
      setLegalAdvanceNotice(advanceNoticeData.value);
    } catch (error) {
      console.error("cannot determine legal advance notice:", error);
      toast.error("Une erreur est survenue lors du calcul du préavis légal.");
    }
  }

  const getConventionAdvanceNotice = async (bpAnalysisResponse: string, conventionSeniority: string, idcc: string) => {
    try {
      const advanceNoticeResponse = await fetch("/api/bp/advanceNotice/convention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: bpAnalysisResponse,
          seniority: conventionSeniority,
          idcc: idcc,
        }),
      });
      const advanceNoticeData = await advanceNoticeResponse.json();
      setConventionAdvanceNoticeMessage(advanceNoticeData.message);
      setConventionAdvanceNotice(advanceNoticeData.value);
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
      setAdvanceNotice(advanceNoticeData.value);
      setAdvanceNoticeMessage(advanceNoticeData.message);
    } catch (error) {
      console.error("cannot compare advance notices:", error);
      toast.error("Une erreur est survenue lors du calcul du préavis le plus favorable.");
    }
  }

  const getLegalReferenceSalary = async (bpAnalysisResponse: string, legalSeniority: string) => {
    try {
      const referenceSalaryResponse = await fetch("/api/bp/referenceSalary/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse,
          legalSeniority,
        }),
      });
      const referenceSalaryData = await referenceSalaryResponse.json();
      setLegalReferenceSalaryMessage(referenceSalaryData.message);
      setLegalReferenceSalary(referenceSalaryData.value);
    } catch (error) {
      console.error("cannot get legal reference salary:", error);
      toast.error("Une erreur est survenue lors du calcul du salaire de référence légal.");
    }
  }

  const getConventionReferenceSalary = async (bpAnalysisResponse: string, legalSeniority: string, idcc: string) => {
    try {
      const referenceSalaryResponse = await fetch("/api/bp/referenceSalary/convention", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse,
          legalSeniority,
          idcc
        }),
      });
      const referenceSalaryData = await referenceSalaryResponse.json();
      setConventionReferenceSalaryMessage(referenceSalaryData.message);
      setConventionReferenceSalary(referenceSalaryData.value);
    } catch (error) {
      console.error("cannot get convention reference salary:", error);
      toast.error("Une erreur est survenue lors du calcul du salaire de référence conventionnel.");
    }
  }

  const getFavorableReferenceSalary = async (legalReferenceSalary: string, conventionReferenceSalary: string) => {
    try {
      const referenceSalaryResponse = await fetch("/api/bp/referenceSalary/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legalReferenceSalary,
          conventionReferenceSalary,
        }),
      });
      const referenceSalaryData = await referenceSalaryResponse.json();
      setFavorableReferenceSalaryMessage(referenceSalaryData.message);
      setReferenceSalary(referenceSalaryData.value);
    } catch (error) {
      console.error("cannot get favorable reference salary:", error);
      toast.error("Une erreur est survenue lors du calcul du salaire de référence favorable.");
    }
  }

  const extractBps = async () => {
    if (!selectedAgreementSuggestion) {
      throw new Error("No selected agreement suggestion.");
    }
    const results: Record<string, string> = {};
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
              const apiUrl = 'https://api.mindee.net/v1/products/mindee/payslip_fra/v3/predict_async';
              const jobStatusUrl = 'https://api.mindee.net/v1/products/mindee/payslip_fra/v3/documents/queue/';
              const formData = new FormData();
              formData.append('document', pdfFiles[i]);
              const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                  Authorization: `Token 76b243229a7d0dc8551401edc4890da4`,
                },
                body: formData,
              });

              // const response = await fetch("/api/bp/analysis", {
              //   method: "POST",
              //   headers: {
              //     "Content-Type": "application/json",
              //   },
              //   body: JSON.stringify(payload),
              // });
              const bpDataExtraction = await response.json();

              const jobId = bpDataExtraction.job.id; // Assuming response contains job ID
              console.log(`Job ID: ${jobId}`);

              // Step 2: Poll for the job status until it's no longer "waiting"
              let jobStatus = 'waiting';
              let statusData;

              while (jobStatus === 'waiting' || jobStatus === 'processing') {
                const statusResponse = await fetch(`${jobStatusUrl}${jobId}`, {
                  method: 'GET',
                  headers: {
                    Authorization: `Token 76b243229a7d0dc8551401edc4890da4`,
                  },
                });

                if (!statusResponse.ok) {
                  throw new Error(`Error fetching status for job ${jobId}: ${statusResponse.statusText}`);
                }

                statusData = await statusResponse.json();
                jobStatus = statusData.job.status;

                if (jobStatus === 'waiting' || jobStatus === 'processing') {
                  console.log(`Job ${jobId} is still waiting. Retrying in 2 seconds...`);
                  await sleep(2000);
                }
              }

              console.log(`Job ${jobId} completed with status: ${jobStatus}`);
              if (jobStatus !== 'completed') {
                throw new Error(`Job ${jobId} failed with status: ${jobStatus}`);
              }

              console.log('statusData:', statusData);

              const month = statusData.document.inference.prediction.pay_period.month;
              if (!response.ok) {
                console.error(`Failed to process ${pdfFiles[i].name}`);
                results[month] = `Error processing: ${pdfFiles[i].name}`;
              }
              results[month] = JSON.stringify(statusData.document);
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

      // Get and set employee info
      const concatenatedBpStr = Object.values(results).join("\n\n");
      const employeeInfoResponse = await fetch("/api/bp/analysis/getEmployeeInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: concatenatedBpStr,
          idcc: selectedAgreementSuggestion.idcc
        }),
      });
      if (!employeeInfoResponse.ok) {
        console.error(`Failed to compute legal indemnities`);
        return;
      }
      const employeeInfoData = await employeeInfoResponse.json();
      setEmployeeName(employeeInfoData.employeeName || "");
      setEntryDate(formatDateToInput(employeeInfoData.entryDate) || "");
      setEarnedPaidLeave(employeeInfoData.earnedPaidLeave || "");
      setLastPaySlipDate(employeeInfoData.lastPaySlipDate || "");
    } catch (error) {
      console.error("Error during extraction:", error);
      throw error;
    } finally {
      setBpExtractionResults(results);
    }
  }

  const startSimulation = async () => {
    if (!selectedAgreementSuggestion) {
      throw new Error("No selected agreement suggestion.");
    }
    try {
      const replaceBpAnalysisResponse = await fetch("/api/bp/replace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse: Object.values(bpExtractionResults).join("\n\n"),
          bpFields,
          employeeName,
          entryDate,
          earnedPaidLeave,
        }),
      });
      if (!replaceBpAnalysisResponse.ok) {
        console.error(`Failed to compute legal indemnities`);
        return;
      }
      const replaceBpAnalysisData = await replaceBpAnalysisResponse.json();
      const bpAnalysisResponse = replaceBpAnalysisData.message;

      // TODO: check eligibility
      // await checkSeveranceEligibility(concatenatedBpStr, selectedAgreementSuggestion.idcc);

      await getConventionSeniority(bpAnalysisResponse, selectedAgreementSuggestion.idcc);
      await getLegalSeniority(bpAnalysisResponse);

      await getLegalAdvanceNotice(bpAnalysisResponse, legalSeniority);
      await getConventionAdvanceNotice(bpAnalysisResponse, conventionSeniority, selectedAgreementSuggestion.idcc);
      await getFavorableAdvanceNotice(legalAdvanceNotice, conventionAdvanceNotice);

      // TODO: inject only values for seniority
      await getLegalReferenceSalary(bpAnalysisResponse, legalSeniority);
      await getConventionReferenceSalary(bpAnalysisResponse, legalSeniority, selectedAgreementSuggestion.idcc);
      await getFavorableReferenceSalary(legalReferenceSalary, conventionReferenceSalary);

      // Parallel API Calls: /compute/legal and /compute/convention
      const legalRequest = fetch("/api/bp/compute/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bpAnalysisResponse,
          advanceNotice: advanceNotice,
          referenceSalary: referenceSalary,
          seniority: legalSeniority
        }),
      });

      const conventionRequest = fetch("/api/bp/compute/convention", {
        method: "POST",
        body: JSON.stringify({
          bpAnalysisResponse,
          idcc: selectedAgreementSuggestion.idcc,
          advanceNotice: advanceNotice,
          referenceSalary: referenceSalary,
          seniority: conventionSeniority
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

      // Check response
      const checkResponse = await fetch("/api/bp/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          legalIndemnitiesResponse: legalData.message,
          conventionIndemnitiesResponse: conventionData.message
        }),
      });
      if (!checkResponse.ok) {
        console.error(`Failed to check indemnities`);
        return;
      }
      const checkedData = await checkResponse.json();
      setCheckedDataMessage(checkedData.message);

      const compareResponse = await fetch("/api/bp/compute/compare", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          checkedResponse: checkedData.message
        }),
      });
      if (!compareResponse.ok) {
        console.error(`Failed to compare indemnities`);
        return;
      }
      const compareData = await compareResponse.json();
      setSeverancePay(compareData.severancePay || "Non spécifié");
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
        console.error("Error during extraction:", error);
      }
    } else if (currentStep === "simulate") {
      try {
        await startSimulation();
      } catch (error) {
        console.error("Error during simulation:", error);
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
              type="text"
              name="earnedPaidLeave"
              placeholder=""
              value={earnedPaidLeave}
              onChange={(e) => setEarnedPaidLeave(e.target.value)}
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
      {isSimulationFinished && (
        <div className="space-y-6 mt-4 border p-4 rounded-md shadow-md bg-gray-50">
          <h3 className="font-medium text-lg text-gray-800 mb-4">📄 Résultats et Calculs</h3>

          {/* Messages d'ancienneté */}
          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsLegalSeniorityMessageVisible(!isLegalSeniorityMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Ancienneté Légale: ${legalSeniority}`}</h4>
              <span>{isLegalSeniorityMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isLegalSeniorityMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {legalSeniorityMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsConventionSeniorityMessageVisible(!isConventionSeniorityMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Ancienneté Conventionnelle: ${conventionSeniority}`}</h4>
              <span>{isConventionSeniorityMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isConventionSeniorityMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {conventionSeniorityMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          {/* Messages de préavis */}
          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsLegalAdvanceNoticeMessageVisible(!isLegalAdvanceNoticeMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Préavis Légal: ${legalAdvanceNotice}`}</h4>
              <span>{isLegalAdvanceNoticeMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isLegalAdvanceNoticeMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {legalAdvanceNoticeMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsConventionAdvanceNoticeMessageVisible(!isConventionAdvanceNoticeMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Préavis Conventionnel: ${conventionAdvanceNotice}`}</h4>
              <span>{isConventionAdvanceNoticeMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isConventionAdvanceNoticeMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {conventionAdvanceNoticeMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsAdvanceNoticeMessageVisible(!isAdvanceNoticeMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Préavis Favorable: ${advanceNotice}`}</h4>
              <span>{isAdvanceNoticeMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isAdvanceNoticeMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {advanceNoticeMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          {/* Messages de salaire de référence */}
          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsLegalReferenceSalaryMessageVisible(!isLegalReferenceSalaryMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Salaire de Référence Légal: ${legalReferenceSalary}`}</h4>
              <span>{isLegalReferenceSalaryMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isLegalReferenceSalaryMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {legalReferenceSalaryMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsConventionReferenceSalaryMessageVisible(!isConventionReferenceSalaryMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Salaire de Référence Conventionnel: ${conventionReferenceSalary}`}</h4>
              <span>{isConventionReferenceSalaryMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isConventionReferenceSalaryMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {conventionReferenceSalaryMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>

          <div>
            <div
              className="flex justify-between items-center cursor-pointer"
              onClick={() => setIsFavorableReferenceSalaryMessageVisible(!isFavorableReferenceSalaryMessageVisible)}
            >
              <h4 className="font-medium text-md text-gray-700">{`Salaire de Référence Favorable: ${referenceSalary}`}</h4>
              <span>{isFavorableReferenceSalaryMessageVisible ? "▲" : "▼"}</span>
            </div>
            {isFavorableReferenceSalaryMessageVisible && (
              <p className="mt-2 text-gray-600 text-sm border-t pt-2">
                {favorableReferenceSalaryMessage || "Aucune donnée disponible."}
              </p>
            )}
          </div>
        </div>
      )}


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
                  value={bpFields[key]?.brut || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = e.target.value;
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [key]: {
                        ...prevFields[key],
                        brut: updatedValue,
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
                  value={bpFields[key]?.period || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = e.target.value;
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
                <label className="block text-sm font-medium text-gray-700">{"Nombre d'arrêt maladie"}</label>
                <Input
                  type="text"
                  name="sickLeaveWorkingDays"
                  placeholder="0"
                  value={bpFields[key]?.sickLeaveWorkingDays || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = e.target.value;
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
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">{"Primes"}</label>
                <Input
                  type="text"
                  name="premiums"
                  placeholder="0"
                  value={bpFields[key]?.premiums || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = e.target.value;
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [key]: {
                        ...prevFields[key],
                        premiums: updatedValue,
                      },
                    }));
                  }}
                />
              </div>

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
                <pre className="text-sm text-gray-800 overflow-auto whitespace-pre-wrap">
                  {checkedDataMessage}
                </pre>
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
