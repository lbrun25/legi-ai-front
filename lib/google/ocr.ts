import {DocumentProcessorServiceClient} from "@google-cloud/documentai";

const docGoogleAiClient = new DocumentProcessorServiceClient({
  apiEndpoint: 'eu-documentai.googleapis.com',
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    project_id: process.env.GCP_PROJECT_ID,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g,"\n"),
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
  },
});

export const performOcr = async (base64File: string, mimeType: string) => {
  const projectNumber = process.env.GCP_PROJECT_NUMBER;
  const location = process.env.GCP_PROJECT_LOCATION || 'eu';
  const processorId = process.env.GCP_PROCESSOR_ID || '';
  const name = `projects/${projectNumber}/locations/${location}/processors/${processorId}`;
  const request = {
    name,
    rawDocument: {
      content: base64File,
      mimeType: mimeType,
    },
  };
  const [result] = await docGoogleAiClient.processDocument(request);
  const {document} = result;

  if (!document || !document.pages) {
    console.error("no document were processed by Google Document AI");
    throw new Error("No document were processed by Google Document AI");
  }
  return document;
}
