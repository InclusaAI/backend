import { Test, TestingModule } from "@nestjs/testing";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";
import {
  ParticipantRequest,
  ParticipantTokenGuard,
} from "../auth/participant-token.guard";
import { AccessibilityChannel } from "./dto/create-preference.dto";

describe("PreferencesController", () => {
  let controller: PreferencesController;
  let service: jest.Mocked<
    Pick<
      PreferencesService,
      "upsertPreference" | "getPreference" | "deletePreference"
    >
  >;

  const preference = {
    sessionId: "clx-session",
    participantId: "clx-participant",
    channels: ["captions"],
    captionLanguage: null,
    translationTargetLanguage: null,
    signLanguage: "ASL",
  };

  /** A request as ParticipantTokenGuard leaves it: ids come from the token. */
  const request = {
    participant: {
      sub: "clx-participant",
      sid: "clx-session",
      uid: "user-1",
      captionsEnabled: false,
    },
  } as ParticipantRequest;

  beforeEach(async () => {
    service = {
      upsertPreference: jest
        .fn()
        .mockResolvedValue({ status: "success", data: preference }),
      getPreference: jest
        .fn()
        .mockResolvedValue({ status: "success", data: preference }),
      deletePreference: jest.fn().mockResolvedValue({ status: "success" }),
    };

    // Authentication itself is covered by the guard's own contract; these tests
    // are about which ids the controller passes on, so the guard is stubbed.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferencesController],
      providers: [{ provide: PreferencesService, useValue: service }],
    })
      .overrideGuard(ParticipantTokenGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PreferencesController>(PreferencesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("reads preferences for the participant in the token, not a client-supplied id", async () => {
    await controller.getPreference(request);

    expect(service.getPreference).toHaveBeenCalledWith(
      "clx-session",
      "clx-participant",
    );
  });

  it("writes preferences for the participant in the token", async () => {
    const dto = { channels: [AccessibilityChannel.CAPTIONS] };

    await controller.upsertPreference(dto, request);

    expect(service.upsertPreference).toHaveBeenCalledWith(
      "clx-session",
      "clx-participant",
      dto,
    );
  });

  it("deletes only the participant's own preferences", async () => {
    await controller.deletePreference(request);

    expect(service.deletePreference).toHaveBeenCalledWith(
      "clx-session",
      "clx-participant",
    );
  });
});
