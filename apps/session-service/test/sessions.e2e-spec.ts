import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { CommunicationMode, Presentation } from '@prisma/client';

describe('Sessions', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string = 'test-user-id';
  let organizationId: string = 'test-org-id';
  let presentation: Presentation;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Mock a JWT token
    token = jwt.sign({ userId, organizationId }, 'test-secret');

    // Create a presentation to start a session for
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
          communicationMode: CommunicationMode.HYBRID,
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
          communicationMode: CommunicationMode.HYBRID,
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