import {UnstructuredClient} from "unstructured-client";

export const unstructuredClient = new UnstructuredClient({
  serverURL: process.env.UNSTRUCTURED_API_URL,
  security: {
    apiKeyAuth: process.env.UNSTRUCTURED_API_KEY,
  },
});
