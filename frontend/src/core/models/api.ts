import { getBackendBaseURL } from "../config";

import { normalizeModelsResponse, type ModelsResponse } from "./normalize";

export async function loadModels() {
  const res = await fetch(`${getBackendBaseURL()}/api/models`);
  if (!res.ok) {
    throw new Error(`Failed to load models: ${res.status}`);
  }
  const payload = (await res.json()) as ModelsResponse;
  return normalizeModelsResponse(payload);
}
