export const getGCPCredentials = () => {
  // for Vercel, use environment variables
  return process.env.GCP_PRIVATE_KEY
    ? {
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY,
      },
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
    }
    // for local development, use gcloud CLI
    : {};
};
