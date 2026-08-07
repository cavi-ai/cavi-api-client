import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW_MAX_CHARS,
  REDACTION_PLACEHOLDER,
  isSensitiveKey,
  redactPreviewText,
  redactSensitiveText,
  redactSensitiveValue,
  stringifyRedacted,
} from "../../../core/http/redaction";

describe("redaction helpers", () => {
  describe("isSensitiveKey", () => {
    it("flags credential-shaped keys across separators and casing", () => {
      for (const key of [
        "apiKey",
        "api_key",
        "api-key",
        "secret",
        "password",
        "privateKey",
        "private_key",
        "credential",
        "authorization",
        "authToken",
        "auth-token",
        "accessToken",
        "refreshToken",
        "token",
        "cookie",
        "model.api_key",
      ]) {
        expect(isSensitiveKey(key)).toBe(true);
      }
    });

    it("does not flag non-credential keys or substring false positives", () => {
      for (const key of ["username", "tokenizer", "description", "id", "count"]) {
        expect(isSensitiveKey(key)).toBe(false);
      }
    });
  });

  describe("redactSensitiveValue", () => {
    it("redacts sensitive keys while preserving structure and safe values", () => {
      const input = {
        safe: "keep",
        auth: { token: "abc", nested: { password: "p", note: "n" } },
        items: [{ apiKey: "k1", label: "ok" }, { label: "ok2" }],
        count: 3,
      };

      expect(redactSensitiveValue(input)).toEqual({
        safe: "keep",
        auth: {
          token: REDACTION_PLACEHOLDER,
          nested: { password: REDACTION_PLACEHOLDER, note: "n" },
        },
        items: [
          { apiKey: REDACTION_PLACEHOLDER, label: "ok" },
          { label: "ok2" },
        ],
        count: 3,
      });
    });

    it("returns primitives unchanged", () => {
      expect(redactSensitiveValue("plain")).toBe("plain");
      expect(redactSensitiveValue(42)).toBe(42);
      expect(redactSensitiveValue(null)).toBeNull();
    });
  });

  describe("redactSensitiveText", () => {
    it("redacts inline key/value secrets and stops at delimiters", () => {
      expect(redactSensitiveText("api_key=sk-123&other=ok")).toBe(
        `api_key=${REDACTION_PLACEHOLDER}&other=ok`,
      );
      expect(redactSensitiveText('{"password":"hunter2"}')).toBe(
        `{"password":"${REDACTION_PLACEHOLDER}"}`,
      );
    });

    it("redacts bearer tokens", () => {
      expect(redactSensitiveText("Bearer abc.def-123")).toBe(
        `Bearer ${REDACTION_PLACEHOLDER}`,
      );
      expect(redactSensitiveText("bearer lower.case-token")).toBe(
        `bearer ${REDACTION_PLACEHOLDER}`,
      );
      expect(redactSensitiveText("authorization: bearer SECRET")).toBe(
        `authorization: ${REDACTION_PLACEHOLDER}`,
      );
      expect(redactSensitiveText("Authorization: Basic dXNlcjpwYXNz")).toBe(
        `Authorization: ${REDACTION_PLACEHOLDER}`,
      );
    });

    it("redacts complete multi-parameter authorization credentials", () => {
      expect(
        redactSensitiveText(
          'Authorization: Digest username="admin", response="digest-secret"',
        ),
      ).toBe(`Authorization: ${REDACTION_PLACEHOLDER}`);
    });

    it("redacts complete quoted values containing whitespace", () => {
      expect(redactSensitiveText('password="two word secret"')).toBe(
        `password="${REDACTION_PLACEHOLDER}"`,
      );
    });

    it("leaves non-sensitive text untouched", () => {
      expect(redactSensitiveText("hello world")).toBe("hello world");
    });
  });

  describe("stringifyRedacted", () => {
    it("returns undefined for undefined", () => {
      expect(stringifyRedacted(undefined)).toBeUndefined();
    });

    it("redacts and serializes objects", () => {
      expect(stringifyRedacted({ token: "abc", ok: 1 })).toBe(
        JSON.stringify({ token: REDACTION_PLACEHOLDER, ok: 1 }),
      );
    });

    it("applies text redaction to string input", () => {
      expect(stringifyRedacted("token=abc")).toBe(`token=${REDACTION_PLACEHOLDER}`);
    });

    it("truncates output beyond the max length", () => {
      const out = stringifyRedacted("x".repeat(20), 5);
      expect(out).toBe("xxxxx...[truncated]");
    });

    it("falls back to a marker for unserializable values", () => {
      expect(stringifyRedacted({ big: 1n })).toBe("[unserializable body]");
    });
  });

  describe("redactPreviewText", () => {
    it("redacts and truncates", () => {
      expect(redactPreviewText("Bearer secrettoken", 6)).toBe("Bearer...[truncated]");
    });

    it("exposes a default preview budget", () => {
      expect(DEFAULT_PREVIEW_MAX_CHARS).toBeGreaterThan(0);
    });
  });
});
