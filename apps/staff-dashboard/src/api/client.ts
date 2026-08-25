import type { paths } from "./types";
import createClient from "openapi-fetch";

export const client = createClient<paths>({ 
  baseUrl: import.meta.env.VITE_API_URL || "http://127.0.0.1:8000" 
});
