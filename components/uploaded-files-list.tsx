import {XIcon} from "lucide-react";

interface UploadedFilesListProps {
  files: File[];
  onDeleteFile: (file: File) => void;
  uploading: boolean;
  progress: Record<string, { uploaded: number; total: number }>; // Track progress per file
}

const UploadedFilesList = ({ files, onDeleteFile, uploading, progress }: UploadedFilesListProps) => {
  if (files.length === 0) return null;

  // To display current page
  /*{`${file.name}: ${percentage}% (${fileProgress.uploaded}/${fileProgress.total} pages)`}*/

  return (
    <div className="rounded-3xl bg-gray-50 dark:bg-gray-900 shadow">
      <h3 className="p-4 text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2">
        {"Mes documents"}
      </h3>
      {uploading ? (
        <div className="flex flex-col justify-center items-center py-4 space-y-2">
          <div className="loader border-t-2 border-blue-500 rounded-full w-6 h-6 animate-spin"></div>
          <span className="text-gray-600">{"Téléchargement..."}</span>
          {files.map((file) => {
            const fileProgress = progress[file.name] || { uploaded: 0, total: 0 };
            const percentage = fileProgress.total
              ? Math.floor((fileProgress.uploaded / fileProgress.total) * 100)
              : 0;

            return (
              <div key={file.name} className="text-xs text-gray-500">
                {`${file.name}: ${percentage}%`}
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="space-y-2 py-2 px-4">
          {files.map((file, index) => (
            <li
              key={index}
              className="flex flex-col space-y-1 py-1"
            >
              <div className="flex flex-row items-center justify-between">
                <span className="text-sm font-medium text-gray-700">
                  {file.name}
                </span>
                <button onClick={() => onDeleteFile(file)} className="ml-4 text-gray-400">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default UploadedFilesList;
