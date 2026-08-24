"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("supertest");
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../src/app.module");
const prisma_service_1 = require("../src/prisma/prisma.service");
const jwt = require("jsonwebtoken");
const client_1 = require("@prisma/client");
describe('Sessions', () => {
    let app;
    let prisma;
    let token;
    let userId = 'test-user-id';
    let organizationId = 'test-org-id';
    let presentation;
    beforeAll(async () => {
        const moduleRef = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();
        prisma = moduleRef.get(prisma_service_1.PrismaService);
        token = jwt.sign({ userId, organizationId }, 'test-secret');
        presentation = await prisma.presentation.create({
            data: {
                name: 'Test Presentation for Sessions',
                slideMetadata: [],
                organizationId,
                ownerId: userId,
            },
        });
    });
    afterAll(async () => {
        await prisma.presentation.deleteMany({});
        await app.close();
    });
    describe('POST /presentations/:id/sessions', () => {
        it('should start a new session', () => {
            return request(app.getHttpServer())
                .post(`/presentations/${presentation.id}/sessions`)
                .set('Authorization', `Bearer ${token}`)
                .send({
                communicationMode: client_1.CommunicationMode.HYBRID,
            })
                .expect(201)
                .then((res) => {
                expect(res.body).toHaveProperty('id');
                expect(res.body.status).toEqual('ACTIVE');
                expect(res.body).toHaveProperty('joinCode');
            });
        });
    });
    describe('DELETE /sessions/:id', () => {
        it('should end a session', async () => {
            const session = await prisma.session.create({
                data: {
                    presentationId: presentation.id,
                    userId,
                    communicationMode: client_1.CommunicationMode.HYBRID,
                    status: 'ACTIVE',
                },
            });
            return request(app.getHttpServer())
                .delete(`/sessions/${session.id}`)
                .set('Authorization', `Bearer ${token}`)
                .expect(200)
                .then((res) => {
                expect(res.body).toHaveProperty('id');
                expect(res.body.status).toEqual('ENDED');
            });
        });
    });
});
//# sourceMappingURL=sessions.e2e-spec.js.map