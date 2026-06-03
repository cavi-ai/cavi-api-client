import { describe, expect, it, vi } from "vitest";
import {
  buildPortalTtsVoiceOptions,
  requestPortalTtsAudio,
} from "../../../../extensions/cavi/portal/tts";

// TTS path is now supplied by the caller (resolved from the team manifest); the
// package binds no concrete agent. A literal path here is just test input.
const TTS_PATH = "/api/plugins/machine/tts";

describe("portal TTS helpers", () => {
  it("prefers configured gateway voices and falls back to dashboard voices", () => {
    expect(
      buildPortalTtsVoiceOptions({
        activeProviderId: "voice-lab",
        providers: [
          {
            id: "voice-lab",
            label: "Voice Lab",
            configured: true,
            voices: [{ id: "voice-1", name: "Host" }, "voice-2"],
          },
        ],
        dashboardVoices: {
          chris: { current_voice_id: "legacy-voice" },
        },
      }),
    ).toMatchObject([
      {
        value: "gateway:voice-lab:voice-1",
        source: "gateway",
        voiceId: "voice-1",
        providerId: "voice-lab",
      },
      {
        value: "gateway:voice-lab:voice-2",
        source: "gateway",
        voiceId: "voice-2",
        providerId: "voice-lab",
      },
    ]);

    expect(
      buildPortalTtsVoiceOptions({
        dashboardVoices: {
          chris: {
            current_voice_id: "legacy-voice",
            current_voice_name: "Legacy Host",
          },
        },
      }),
    ).toMatchObject([
      {
        value: "dashboard:chris:legacy-voice",
        source: "dashboard",
        voiceId: "legacy-voice",
      },
    ]);
  });

  it("normalizes TTS request text, voice/provider hints, format, and accept", async () => {
    const requestBlob = vi.fn(async () => new Blob(["audio"]));

    await expect(
      requestPortalTtsAudio(
        { requestBlob },
        TTS_PATH,
        {
          text: "  hello voice lab  ",
          voiceId: " voice-1 ",
          providerId: " voice-lab ",
          format: " mp3 ",
          accept: " audio/wav ",
          options: { stability: 0.7 },
        },
      ),
    ).resolves.toBeInstanceOf(Blob);

    expect(requestBlob).toHaveBeenCalledWith(TTS_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/wav",
      },
      body: {
        text: "hello voice lab",
        voiceId: "voice-1",
        providerId: "voice-lab",
        format: "mp3",
        options: { stability: 0.7 },
      },
    });
  });

  it("rejects blank TTS text before making a request", async () => {
    const requestBlob = vi.fn(async () => new Blob(["audio"]));

    await expect(
      requestPortalTtsAudio({ requestBlob }, TTS_PATH, { text: "   " }),
    ).rejects.toThrow(/Enter text/u);
    expect(requestBlob).not.toHaveBeenCalled();
  });
});
