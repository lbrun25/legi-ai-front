"use client"
import React, {useCallback, useEffect, useState} from 'react'
import {DragZoneFiles} from "@/components/drag-zone-files";
import UploadedFilesList from "@/components/uploaded-files-list";
import {Button} from "@/components/ui/button";
import {convertPdfToImages} from "@/lib/utils/file";
import {Input} from "@/components/ui/input";
import {formatDateToInput} from "@/lib/utils/date";
import * as Accordion from "@radix-ui/react-accordion";

export default function Page() {
  const [bpFiles, setBpFiles] = useState<File[]>([]);
  const [conventionFiles, setConventionFiles] = useState<File[]>([]);
  const onDropBps = useCallback((acceptedFiles: File[]) => {
    setBpFiles(acceptedFiles);
  }, []);
  const onDropConvention = useCallback((acceptedFiles: File[]) => {
    setConventionFiles(acceptedFiles);
  }, []);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bpExtractionResults, setBpExtractionResults] = useState<Record<string, string>>({});
  const [bpFields, setBpFields] = useState<Record<string, { brut?: string; period?: string }>>({});
  const [employeeName, setEmployeeName] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [earnedPaidLeave, setEarnedPaidLeave] = useState("");
  const [currentStep, setCurrentStep] = useState<"extract" | "simulate">("extract");
  const [isEditableInfoVisible, setIsEditableInfoVisible] = useState(false);
  const [severancePay, setSeverancePay] = useState<string | null>(null);
  const [isSimulationFinished, setIsSimulationFinished] = useState(false);
  const [isCheckedDataVisible, setIsCheckedDataVisible] = useState(false);
  const [checkedDataMessage, setCheckedDataMessage] = useState<string>("");
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  const handleDeleteFile = (fileToDelete: File) => {
    setBpFiles((prevFiles) => prevFiles.filter((file) => file !== fileToDelete));
  };

  const setFieldsForBps = async (results: Record<string, string>) => {
    const updatedFields: Record<string, { brut?: string; period?: string }> = {};

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

        const { brut, period } = await getBrutFromBpResponse.json();
        updatedFields[fileName] = { brut, period };
      } catch (error) {
        console.error(`Error extracting data from ${fileName}:`, error);
      }
    }
    console.log("Updated fields: ", updatedFields);
    setBpFields((prevFields) => ({ ...prevFields, ...updatedFields }));
  };

  const extractBps = async () => {
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
              const pdfPages = await convertPdfToImages(pdfFiles[i]);
              const payload = {
                filename: pdfFiles[i].name,
                fileBase64: pdfPages[0], // Assume the first page contains the BP
              };

              const response = await fetch("/api/bp/analysis", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
              });
              if (!response.ok) {
                console.error(`Failed to process ${pdfFiles[i].name}`);
                results[pdfFiles[i].name] = `Error processing: ${pdfFiles[i].name}`;
              }
              const bpDataExtraction = await response.json();
              results[pdfFiles[i].name] = bpDataExtraction.message;
            } catch (error) {
              console.error(`Error processing ${pdfFiles[i].name}:`, error);
              results[pdfFiles[i].name] = `Error processing: ${pdfFiles[i].name}`;
            }
          })()
        );
        await sleep(1000);
      }
      await Promise.all(processingTasks);
      await setFieldsForBps(results);

      // Get and set employee info
      const concatenatedBpStr = Object.values(results).join("\n\n");
      const employeeInfoResponse = await fetch("/api/bp/analysis/getEmployeeInfo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({bpAnalysisResponse: concatenatedBpStr}),
      });
      if (!employeeInfoResponse.ok) {
        console.error(`Failed to compute legal indemnities`);
        return;
      }
      const employeeInfoData = await employeeInfoResponse.json();
      setEmployeeName(employeeInfoData.employeeName || "");
      setEntryDate(formatDateToInput(employeeInfoData.entryDate) || "");
      setEarnedPaidLeave(employeeInfoData.earnedPaidLeave || "");
    } catch (error) {
      console.error("Error during extraction:", error);
      throw error;
    } finally {
      setBpExtractionResults(results);
    }
  }

  const startSimulation = async () => {
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

      // Parallel API Calls: /compute/legal and /compute/convention
      const legalRequest = fetch("/api/bp/compute/legal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ bpAnalysisResponse }),
      });

      const conventionFormData = new FormData();
      conventionFormData.append("file", conventionFiles[0]);
      conventionFormData.append("bpAnalysisResponse", bpAnalysisResponse);

      const conventionRequest = fetch("/api/bp/compute/convention", {
        method: "POST",
        body: conventionFormData,
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

      const compareResponse = await fetch("/api/bp/compare", {
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

      {/* Collective Agreement Drag Zone */}
      <DragZoneFiles
        onDrop={onDropConvention}
        dragActiveLabel="Déposez votre convention collective ici..."
        label={(
          <p className="text-gray-600">
            {"Glissez-déposez votre convention collective ici, ou "}
            <span className="text-blue-500 font-medium underline">{"cliquez"}</span>{" "}
            {"pour le sélectionner."}
          </p>
        )}
      />

      {/* List of Uploaded Files */}
      <UploadedFilesList
        files={[...bpFiles, ...conventionFiles]}
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
        </div>
      )}

      {/* Display Extracted Fields for Each Pay Slip */}
      {isEditableInfoVisible && (
        <div className="space-y-4 mt-4">
          {bpFiles.map((file) => (
            <div
              key={file.name}
              className="border p-4 rounded-md shadow-md bg-gray-50"
            >
              <h3 className="font-medium text-lg text-gray-800 mb-2">{file.name}</h3>

              {/* Gross Salary Field */}
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700">{"Salaire brut"}</label>
                <Input
                  type="text"
                  name="grossSalary"
                  placeholder="Salaire brut"
                  value={bpFields[file.name]?.brut || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = e.target.value;
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [file.name]: {
                        ...prevFields[file.name],
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
                  value={bpFields[file.name]?.period || ""}
                  className="pr-14 h-12"
                  onChange={(e) => {
                    const updatedValue = e.target.value;
                    setBpFields((prevFields) => ({
                      ...prevFields,
                      [file.name]: {
                        ...prevFields[file.name],
                        period: updatedValue,
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
              {/*    value={bpFields[file.name]?.natureAdvantage || ""}*/}
              {/*    className="pr-14 h-12"*/}
              {/*    onChange={(e) => {*/}
              {/*      const updatedValue = e.target.value;*/}
              {/*      setBpFields((prevFields) => ({*/}
              {/*        ...prevFields,*/}
              {/*        [file.name]: {*/}
              {/*          ...prevFields[file.name],*/}
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

      {/* Start Simulation Button */}
      {!isSimulationFinished && (
        <Button
          variant="default"
          onClick={onButtonClicked}
          disabled={isProcessing || bpFiles.length === 0}
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
              <Accordion.Trigger className="flex justify-between items-center w-full py-2 px-4 border rounded-md bg-gray-50 hover:bg-gray-100">
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
