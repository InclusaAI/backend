import { Test, TestingModule } from "@nestjs/testing";
import { PreferencesController } from "./preferences.controller";
import { PreferencesService } from "./preferences.service";

describe("PreferencesController", () => {
  let controller: PreferencesController;
  let service: jest.Mocked<Pick<PreferencesService, "findOne" | "update">>;

  const preference = {
    id: "pref-1",
    userId: "user-1",
    captionsEnabled: false,
    avatarEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      findOne: jest.fn().mockResolvedValue(preference),
      update: jest
        .fn()
        .mockResolvedValue({ ...preference, captionsEnabled: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PreferencesController],
      providers: [{ provide: PreferencesService, useValue: service }],
    }).compile();

    controller = module.get<PreferencesController>(PreferencesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("reads preferences for the authenticated user, not a client-supplied id", async () => {
    const req = { user: { userId: "user-1" } };

    await expect(controller.findOne(req)).resolves.toEqual(preference);
    expect(service.findOne).toHaveBeenCalledWith("user-1");
  });

  it("updates preferences for the authenticated user", async () => {
    const req = { user: { userId: "user-1" } };
    const dto = { captionsEnabled: true };

    const result = await controller.update(req, dto);

    expect(service.update).toHaveBeenCalledWith("user-1", dto);
    expect(result.captionsEnabled).toBe(true);
  });
});
