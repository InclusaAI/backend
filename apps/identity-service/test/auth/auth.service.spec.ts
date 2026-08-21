import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('signUp', () => {
    it('should throw a ConflictException if user already exists', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
      await expect(service.signUp({ email: 'test@test.com', password: 'password' })).rejects.toThrow(ConflictException);
    });

    it('should create a new user and return an access token', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ id: '1', email: 'test@test.com' });
      mockJwtService.sign.mockReturnValue('accessToken');

      const result = await service.signUp({ email: 'test@test.com', password: 'password' });
      expect(result).toEqual({ accessToken: 'accessToken' });
    });
  });

  describe('login', () => {
    it('should throw an UnauthorizedException if user does not exist', async () => {
        mockPrismaService.user.findUnique.mockResolvedValue(null);
        await expect(service.login({ email: 'test@test.com', password: 'password' })).rejects.toThrow(UnauthorizedException);
    });

    it('should throw an UnauthorizedException if password does not match', async () => {
        const user = { id: '1', email: 'test@test.com', password: 'hashedPassword' };
        mockPrismaService.user.findUnique.mockResolvedValue(user);
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
        await expect(service.login({ email: 'test@test.com', password: 'wrongpassword' })).rejects.toThrow(UnauthorizedException);
    });

    it('should return an access token if credentials are valid', async () => {
        const user = { id: '1', email: 'test@test.com', password: 'hashedPassword' };
        mockPrismaService.user.findUnique.mockResolvedValue(user);
        jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));
        mockJwtService.sign.mockReturnValue('accessToken');

        const result = await service.login({ email: 'test@test.com', password: 'password' });
        expect(result).toEqual({ accessToken: 'accessToken' });
    });
  });
});