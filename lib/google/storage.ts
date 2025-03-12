import { Storage } from '@google-cloud/storage';

const BUCKET_NAME = 'training_bp';

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    project_id: process.env.GCP_PROJECT_ID,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g,"\n"),
    client_email: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
  },
});
const bucket = storage.bucket(BUCKET_NAME);

/**
 * Check if a file already exists in GCS.
 */
export const checkFileExists = async (fileName: string): Promise<boolean> => {
  const file = bucket.file(fileName);
  const [exists] = await file.exists();
  return exists;
};

/**
 * Upload a PDF to GCS if it doesn't already exist.
 */
export const uploadFileToGCS = async (file: File, filename: string): Promise<string> => {
  const gcsFile = bucket.file(filename);

  // Check if file exists
  const alreadyExists = await checkFileExists(filename);
  if (alreadyExists) {
    console.log(`File "${filename}" already exists in GCS.`);
    return `gs://${BUCKET_NAME}/${filename}`; // Return existing file path
  }

  // Create a stream to upload with the appropriate metadata
  const stream = gcsFile.createWriteStream({
    metadata: { contentType: file.type },
  });

  return new Promise((resolve, reject) => {
    stream.on("error", (err) => reject(err));
    stream.on("finish", () => {
      console.log(`File "${filename}" uploaded to GCS.`);
      resolve(`gs://${BUCKET_NAME}/${filename}`);
    });

    // Convert the File to a Buffer
    file.arrayBuffer()
      .then((arrayBuffer) => {
        const buffer = Buffer.from(arrayBuffer);
        stream.end(buffer);
      })
      .catch((err) => reject(err));
  });
};

/**
 * Generate a signed URL for accessing the file.
 */
export const getPublicUrl = async (fileName: string): Promise<string> => {
  const file = bucket.file(fileName);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24, // 24 hours expiration
  });
  return url;
};
