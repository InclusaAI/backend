import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

describe('Presentations', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string = 'test-user-id';
  let organizationId: string = 'test-org-id';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get<PrismaService>(PrismaService);

    // Mock a JWT token
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