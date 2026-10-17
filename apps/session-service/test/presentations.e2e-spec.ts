import * as request from "supertest";
import { Test } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as jwt from "jsonwebtoken";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Requires a running Postgres and the session_db schema:
 *   docker compose -f docker-compose.dev.yml up -d
 *   pnpm --filter session-service db:migrate
 *
 * Run with `pnpm --filter session-service test:e2e`.
 */
describe("Presentations (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
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
  });

  afterAll(async () => {
    await prisma.presentation.deleteMany({});
    await app.close();
  });

  describe("POST /presentations", () => {
    it("creates a presentation owned by the authenticated user", () => {
      return request(app.getHttpServer())
        .post("/presentations")
        .set("Authorization", `Bearer ${token}`)
        .send({
          name: "Test Presentation",
          slideMetadata: [{ order: 1, url: "http://example.com/slide1.jpg" }],
          organizationId,
        })
        .expect(201)
        .then((res) => {
          expect(res.body).toHaveProperty("id");
          expect(res.body.name).toEqual("Test Presentation");
          expect(res.body.ownerId).toEqual(userId);
        });
    });

    it("rejects an unauthenticated request", () => {
      return request(app.getHttpServer())
        .post("/presentations")
        .send({ name: "No token", slideMetadata: [], organizationId })
        .expect(401);
    });
  });
});
