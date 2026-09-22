import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";
import { CommunicationMode, Presentation } from "../src/prisma/client";

/**
 * Requires a running Postgres and the session_db schema:
 *   docker compose -f docker-compose.dev.yml up -d
 *   pnpm --filter session-service db:migrate
 *
 * Run with `pnpm --filter session-service test:e2e`.
 */
describe("Sessions (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let presentation: Presentation;
  const userId = "test-user-id";
  const organizationId = "test-org-id";

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);

    // `sub`, not `userId`: JwtStrategy.validate maps payload.sub -> req.user.userId.
    // Signed with the service's configured secret so verification succeeds.
    token = jwt.sign(
      { sub: userId, email: "test@test.com" },
      process.env.JWT_SECRET as string,
      { expiresIn: "1h" },
    );

    presentation = await prisma.presentation.create({
      data: {
        name: "Test Presentation for Sessions",
        slideMetadata: [],
        organizationId,
        ownerId: userId,
      },
    });
  });

  afterAll(async () => {
    await prisma.sessionParticipant.deleteMany({});
    await prisma.joinToken.deleteMany({});
    await prisma.session.deleteMany({});
    await prisma.presentation.deleteMany({});
    await app.close();
  });

  describe("POST /presentations/:id/sessions", () => {
    it("starts a session and returns a join code", () => {
      return request(app.getHttpServer())
        .post(`/presentations/${presentation.id}/sessions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ communicationMode: CommunicationMode.HYBRID })
        .expect(201)
        .then((res) => {
          expect(res.body).toHaveProperty("id");
          expect(res.body.status).toEqual("ACTIVE");
          expect(res.body.joinCode).toMatch(/^[A-Z2-9]{6}$/);
        });
    });
  });

  describe("POST /sessions/join", () => {
    it("admits an anonymous participant by join code", async () => {
      const started = await request(app.getHttpServer())
        .post(`/presentations/${presentation.id}/sessions`)
        .set("Authorization", `Bearer ${token}`)
        .send({ communicationMode: CommunicationMode.SPEECH })
        .expect(201);

      return request(app.getHttpServer())
        .post("/sessions/join")
        .send({ joinCode: started.body.joinCode, displayName: "Anon" })
        .expect(201)
        .then((res) => {
          expect(res.body.sessionId).toEqual(started.body.id);
          expect(res.body.userId).toBeNull();
          expect(res.body.displayName).toEqual("Anon");
          expect(res.body.avatarEnabled).toBe(true);
        });
    });

    it("rejects an unknown join code", () => {
      return request(app.getHttpServer())
        .post("/sessions/join")
        .send({ joinCode: "ZZZZZZ" })
        .expect(404);
    });
  });

  describe("DELETE /sessions/:id", () => {
    it("ends a session", async () => {
      const session = await prisma.session.create({
        data: {
          presentationId: presentation.id,
          userId,
          communicationMode: CommunicationMode.HYBRID,
          status: "ACTIVE",
        },
      });

      return request(app.getHttpServer())
        .delete(`/sessions/${session.id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty("id");
          expect(res.body.status).toEqual("ENDED");
        });
    });
  });
});
