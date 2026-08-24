import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

describe('PreferencesController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let jwtService: JwtService;
  const userId = 'test-user-id';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
    const configService = app.get<ConfigService>(ConfigService);
    jwtService = app.get<JwtService>(JwtService);

    // Clean up database
    await prisma.accessibilityPreference.deleteMany({});

    // Create a token
    token = jwtService.sign({
  sub: userId,
  email: 'test@test.com',
});
    // token = jwt.sign({ sub: userId, email: 'test@test.com' }, configService.get('JWT_SECRET'));
  });

  afterAll(async () => {
    await prisma.accessibilityPreference.deleteMany({});
    await app.close();
  });

  it('/preferences (GET) - should create and return default preferences for a new user', () => {
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

  it('/preferences (PATCH) - should update user preferences', async () => {
    await request(app.getHttpServer())
      .patch('/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ captionsEnabled: true, avatarEnabled: false })
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty('captionsEnabled', true);
        expect(res.body).toHaveProperty('avatarEnabled', false);
      });

    // Verify the update
    return request(app.getHttpServer())
      .get('/preferences')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .then((res) => {
        expect(res.body).toHaveProperty('captionsEnabled', true);
        expect(res.body).toHaveProperty('avatarEnabled', false);
      });
  });

  it('/preferences (PATCH) - should reject invalid data', () => {
    return request(app.getHttpServer())
      .patch('/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ captionsEnabled: 'not-a-boolean' })
      .expect(400);
  });

});