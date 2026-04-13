import assert from "node:assert/strict";
import test from "node:test";

// @ts-ignore Node's test runner resolves the source file with the explicit .ts extension.
import { normalizeModelsResponse } from "./normalize.ts";

void test("normalizeModelsResponse reads the current gateway data payload", () => {
  const models = normalizeModelsResponse({
    data: [
      {
        id: "glm-5.1",
        name: "glm-5.1",
        model: "glm-5.1",
        display_name: "GLM-5.1 (Zhipu)",
        supports_thinking: false,
      },
    ],
  });

  assert.equal(models.length, 1);
  assert.equal(models[0]?.name, "glm-5.1");
});

void test("normalizeModelsResponse keeps backward compatibility with legacy models payload", () => {
  const models = normalizeModelsResponse({
    models: [
      {
        id: "gpt-5",
        name: "gpt-5",
        model: "gpt-5",
        display_name: "GPT-5",
        supports_thinking: true,
      },
    ],
  });

  assert.equal(models.length, 1);
  assert.equal(models[0]?.name, "gpt-5");
});

void test("normalizeModelsResponse returns an empty list for empty payloads", () => {
  assert.deepEqual(normalizeModelsResponse({ data: null }), []);
  assert.deepEqual(normalizeModelsResponse({ models: null }), []);
});
