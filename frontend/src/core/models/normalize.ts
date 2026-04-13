import type { Model } from "./types";

export type ModelsResponse =
  | { data?: Model[] | null; models?: never }
  | { data?: never; models?: Model[] | null };

export function normalizeModelsResponse(payload: ModelsResponse): Model[] {
  return payload.data ?? payload.models ?? [];
}
