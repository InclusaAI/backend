"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const jwt = require("jsonwebtoken");
describe('Presentations', () => {
    let app;
    let prisma;
    let token;
    let userId = 'test-user-id';
    let organizationId = 'test-org-id';
    beforeAll(async () => {
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
        prisma = moduleRef.get(prisma_service_1.PrismaService);
        token = jwt.sign({ userId, organizationId }, 'test-secret');
    });
    afterAll(async () => {
        await app.close();
    });
    describe('POST /presentations', () => {
        it('should create a new presentation', () => {
            return request(app.getHttpServer())
                .post('/presentations')
                .set('Authorization', `Bearer ${token}`)
                .send({
                name: 'Test Presentation',
                slideMetadata: [{ order: 1, url: 'http://example.com/slide1.jpg' }],
                organizationId,
            })
                .expect(201)
                .then((res) => {
                expect(res.body).toHaveProperty('id');
                expect(res.body.name).toEqual('Test Presentation');
                expect(res.body.ownerId).toEqual(userId);
            });
        });
    });
});
//# sourceMappingURL=presentations.e2e-spec.js.map