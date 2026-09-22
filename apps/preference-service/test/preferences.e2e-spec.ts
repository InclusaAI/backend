import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import * as jwt from "jsonwebtoken";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Requires a running Postgres and the preference_db schema:
 *   docker compose -f docker-compose.dev.yml up -d
 *   pnpm --filter preference-service db:migrate
 *
 * Run with `pnpm --filter preference-service test:e2e`.
 */
describe("PreferencesController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  const userId = "test-user-id";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await prisma.accessibilityPreference.deleteMany({});

    // Signed with the same secret the service verifies with, and with `sub`
    // as the subject claim — JwtStrategy.validate reads payload.sub.
    token = jwt.sign(
      { sub: userId, email: "test@test.com" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );
  });

  afterAll(async () => {
    await prisma.accessibilityPreference.deleteMany({});
    await app.close();
  });

  it("GET /preferences creates and returns defaults for a first-time user", () => {
    return request(app.getHttpServer())
      .get("/preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty("userId", userId);
        expect(res.body).toHaveProperty("captionsEnabled", false);
        expect(res.body).toHaveProperty("avatarEnabled", true);
      });
  });

  it("PATCH /preferences updates and persists preferences", async () => {
    await request(app.getHttpServer())
      .patch("/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ captionsEnabled: true, avatarEnabled: false })
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty("captionsEnabled", true);
        expect(res.body).toHaveProperty("avatarEnabled", false);
      });

    return request(app.getHttpServer())
      .get("/preferences")
      .set("Authorization", `Bearer ${token}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty("captionsEnabled", true);
        expect(res.body).toHaveProperty("avatarEnabled", false);
      });
  });

  it("PATCH /preferences rejects a non-boolean value", () => {
    return request(app.getHttpServer())
      .patch("/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ captionsEnabled: "not-a-boolean" })
      .expect(400);
  });

  it("GET /preferences rejects an unauthenticated request", () => {
    return request(app.getHttpServer()).get("/preferences").expect(401);
  });

  // Regression: update() used a plain Prisma update, which throws P2025 when no
  // row exists yet and surfaced as a 500. A participant whose very first action
  // is toggling captions never triggers the GET that lazily creates the row.
  it("PATCH /preferences succeeds for a user with no existing row", async () => {
    const freshUserId = "first-timer-" + Date.now();
    const freshToken = jwt.sign(
      { sub: freshUserId, email: "first@test.com" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    await request(app.getHttpServer())
      .patch("/preferences")
      .set("Authorization", `Bearer ${freshToken}`)
      .send({ captionsEnabled: true })
      .expect(200)
      .then((res) => {
        expect(res.body.userId).toEqual(freshUserId);
        expect(res.body.captionsEnabled).toBe(true);
        // Untouched field keeps its schema default.
        expect(res.body.avatarEnabled).toBe(true);
      });
  });

  // Issue #4 acceptance criterion: preferences belong to the participant and
  // outlive any one login session.
  it("persists a preference across two different login sessions", async () => {
    const tokenTwo = jwt.sign(
      { sub: userId, email: "test@test.com" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    await request(app.getHttpServer())
      .patch("/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ captionsEnabled: true, avatarEnabled: false })
      .expect(200);

    return request(app.getHttpServer())
      .get("/preferences")
      .set("Authorization", `Bearer ${tokenTwo}`)
      .expect(200)
      .then((res) => {
        expect(res.body.captionsEnabled).toBe(true);
        expect(res.body.avatarEnabled).toBe(false);
      });
  });
});
