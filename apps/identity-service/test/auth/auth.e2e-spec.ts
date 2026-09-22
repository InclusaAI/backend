import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import * as request from "supertest";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";

describe("AuthController (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await app.close();
  });

  describe("/auth/signup (POST)", () => {
    it("should create a new user", () => {
      return request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "test@test.com", password: "password123" })
        .expect(201)
        .then((res) => {
          expect(res.body).toHaveProperty("accessToken");
        });
    });

    it("should not create a user with the same email", () => {
      return request(app.getHttpServer())
        .post("/auth/signup")
        .send({ email: "test@test.com", password: "password123" })
        .expect(409);
    });
  });

  describe("/auth/login (POST)", () => {
    it("should login the user", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "test@test.com", password: "password123" })
        .expect(200)
        .then((res) => {
          expect(res.body).toHaveProperty("accessToken");
        });
    });

    it("should not login with wrong password", () => {
      return request(app.getHttpServer())
        .post("/auth/login")
        .send({ email: "test@test.com", password: "wrongpassword" })
        .expect(401);
    });
  });
});
