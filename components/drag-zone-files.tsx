import React from "react";
import {useDropzone} from "react-dropzone";

interface DragZoneFilesProps {
  label: React.ReactNode | string;
  onDrop: (file: any) => void;
  dragActiveLabel: string;
}

export const DragZoneFiles = ({onDrop, label, dragActiveLabel}: DragZoneFilesProps) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  return (
    <div
      {...getRootProps()}
      className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-3xl cursor-pointer transition-all bg-gray-50 dark:bg-gray-900 px-8 text-center
      ${
        isDragActive
          ? "border-blue-200"
          : "border-gray-200 hover:border-blue-200"
      }`}
    >
      <input {...getInputProps()} className="hidden" />
      {isDragActive ? (
        <p className="text-blue-500 font-medium">
          {dragActiveLabel}
          {"Déposez des bulletins de paie ici..."}
        </p>
      ) : (
        label
      )}
    </div>
  );
}
