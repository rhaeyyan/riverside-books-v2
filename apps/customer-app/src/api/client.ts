
import type { paths } from "./types";
import createClient from "openapi-fetch";

export const client = createClient<paths>({ baseUrl: "http://127.0.0.1:8000" });
