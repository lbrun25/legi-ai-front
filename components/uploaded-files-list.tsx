import React from 'react';
import {XIcon} from "lucide-react";

interface UploadedFilesListProps {
  files: File[];
  onDeleteFile: (file: File) => void;
  uploading: boolean;
}

const UploadedFilesList = ({ files, onDeleteFile, uploading }: UploadedFilesListProps) => {
  if (files.length === 0) return null;
  return (
    <div className="rounded-3xl bg-gray-50 dark:bg-gray-900 shadow">
      <h3 className="p-4 text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
        {"Mes documents"}
      </h3>
      {uploading ? (
        <div className="flex justify-center items-center py-4">
          <div className="loader border-t-2 border-blue-500 rounded-full w-6 h-6 animate-spin"></div>
          <span className="ml-2 text-gray-600">{"Téléchargement..."}</span>
        </div>
      ) : (
        <ul className="space-y-2  py-2 px-4">
          {files.map((file, index) => (
            <li
              key={index}
              className="flex flex-row items-center justify-between py-1"
            >
              <span className="text-sm font-medium text-gray-700">
                {file.name}
              </span>
              <button onClick={() => onDeleteFile(file)} className="ml-4 text-gray-400">
                <XIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UploadedFilesList;
