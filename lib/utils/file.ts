import {DocumentProcessorServiceClient} from "@google-cloud/documentai";
import { PDFDocument } from 'pdf-lib';
import fs from 'fs/promises';

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Extract only the Base64 part of the Data URL
      const base64String = (reader.result as string).split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });

export async function convertPdfToImages(pdfFile: File): Promise<string[]> {
  try {
    const formData = new FormData();
    formData.append("pdf", pdfFile);
    // const response = await fetch("https://convert-pdf-739114993089.europe-west9.run.app/convert-pdf", {
    const response = await fetch("https://convert-pdf-739114993089.europe-west9.run.app/convert-pdf", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      throw new Error(`Failed to convert PDF: ${response.statusText}`);
    }
    const result = await response.json();
    return result.images; // This will be an array of base64-encoded images
  } catch (error) {
    console.error("Error converting PDF to images:", error);
    throw error;
  }
}

export function fileToBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // When the file is successfully read
    reader.onloadend = () => {
      if (reader.result) {
        // Convert the result to a Blob
        const blob = new Blob([reader.result]);
        resolve(blob);
      } else {
        reject(new Error("File could not be read."));
      }
    };

    // Handle errors
    reader.onerror = () => {
      reject(reader.error);
    };

    // Read the file as an ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
}

export async function extractFirstPageAsBase64(pdfFile: File): Promise<string> {
  // Convert File to ArrayBuffer
  const arrayBuffer = await pdfFile.arrayBuffer();

  // Load original PDF
  const originalPdf = await PDFDocument.load(arrayBuffer);

  // Create new PDF
  const newPdf = await PDFDocument.create();

  // Copy the first page from original PDF to new PDF
  const [copiedPage] = await newPdf.copyPages(originalPdf, [0]); // <-- Fix is here
  newPdf.addPage(copiedPage);

  // Convert to Base64
  const newPdfBytes = await newPdf.save();
  return Buffer.from(newPdfBytes).toString('base64');
}
