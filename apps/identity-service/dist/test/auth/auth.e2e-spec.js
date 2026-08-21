"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const common_1 = require("@nestjs/common");
const request = require("supertest");
const app_module_1 = require("../../src/app.module");
const prisma_service_1 = require("../../src/prisma/prisma.service");
describe('AuthController (e2e)', () => {
    let app;
    let prisma;
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new common_1.ValidationPipe());
        await app.init();
        prisma = app.get(prisma_service_1.PrismaService);
        await prisma.user.deleteMany();
    });
    afterAll(async () => {
        await prisma.user.deleteMany();
        await app.close();
    });
    describe('/auth/signup (POST)', () => {
        it('should create a new user', () => {
            return request(app.getHttpServer())
                .post('/auth/signup')
                .send({ email: 'test@test.com', password: 'password123' })
                .expect(201)
                .then((res) => {
                expect(res.body).toHaveProperty('accessToken');
            });
        });
        it('should not create a user with the same email', () => {
            return request(app.getHttpServer())
                .post('/auth/signup')
                .send({ email: 'test@test.com', password: 'password123' })
                .expect(409);
        });
    });
    describe('/auth/login (POST)', () => {
        it('should login the user', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'test@test.com', password: 'password123' })
                .expect(200)
                .then((res) => {
                expect(res.body).toHaveProperty('accessToken');
            });
        });
        it('should not login with wrong password', () => {
            return request(app.getHttpServer())
                .post('/auth/login')
                .send({ email: 'test@test.com', password: 'wrongpassword' })
                .expect(401);
        });
    });
});
//# sourceMappingURL=auth.e2e-spec.js.map