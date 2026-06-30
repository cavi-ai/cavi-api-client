import { describe, expect, it } from "vitest";
import { buildGeminiRequestBody } from "../../../providers/gemini/client";

describe("buildGeminiRequestBody", () => {
  it("throws ValidationFailed when no model is given", () => {
    expect(() => buildGeminiRequestBody({ input: "hi" })).toThrowError(/model is required/);
  });

  it("maps a string input to a single user turn and uses defaultModel", () => {
    const { model, payload } = buildGeminiRequestBody({ input: "hi" }, "gemini-2.5-flash");
    expect(model).toBe("gemini-2.5-flash");
    expect(payload).toEqual({ contents: [{ role: "user", parts: [{ text: "hi" }] }] });
  });

  it("routes instructions + system-role messages into systemInstruction, assistant->model", () => {
    const { payload } = buildGeminiRequestBody({
      model: "gemini-2.5-pro",
      input: [
        { role: "system", content: "Be terse." },
        { role: "user", content: "Q1" },
        { role: "assistant", content: "A1" },
        { role: "user", content: "Q2" },
      ],
      instructions: "You are helpful.",
    });
    expect(payload.systemInstruction).toEqual({
      parts: [{ text: "You are helpful." }, { text: "Be terse." }],
    });
    expect(payload.contents).toEqual([
      { role: "user", parts: [{ text: "Q1" }] },
      { role: "model", parts: [{ text: "A1" }] },
      { role: "user", parts: [{ text: "Q2" }] },
    ]);
  });

  it("passes tools and metadata.generationConfig through", () => {
    const { payload } = buildGeminiRequestBody({
      model: "gemini-2.5-flash",
      input: "hi",
      tools: [{ functionDeclarations: [] }],
      metadata: { generationConfig: { maxOutputTokens: 256 } },
    });
    expect(payload.tools).toEqual([{ functionDeclarations: [] }]);
    expect(payload.generationConfig).toEqual({ maxOutputTokens: 256 });
  });
});
