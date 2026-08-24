import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

describe('PreferencesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);

    // Create a user and generate a token
    const user = await prisma.user.create({
      data: {
        email: 'preferences-test@example.com',
        password: 'password',
      },
    });
    userId = user.id;
    token = jwt.sign({ sub: userId, email: user.email }, process.env.JWT_SECRET);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({});
    await app.close();
  });

  it('/preferences (GET)', () => {
    return request(app.getHttpServer())
      .get('/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty('userId', userId);
        expect(res.body).toHaveProperty('captionsEnabled', false);
        expect(res.body).toHaveProperty('avatarEnabled', true);
      });
  });

  it('/preferences (PATCH)', () => {
    return request(app.getHttpServer())
      .patch('/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ captionsEnabled: true })
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty('captionsEnabled', true);
      });
  });
});