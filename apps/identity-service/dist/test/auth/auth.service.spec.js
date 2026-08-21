"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const auth_service_1 = require("./auth.service");
const prisma_service_1 = require("../prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const common_1 = require("@nestjs/common");
const bcrypt = require("bcrypt");
describe('AuthService', () => {
    let service;
    let prisma;
    let jwtService;
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
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                { provide: prisma_service_1.PrismaService, useValue: mockPrismaService },
                { provide: jwt_1.JwtService, useValue: mockJwtService },
            ],
        }).compile();
        service = module.get(auth_service_1.AuthService);
        prisma = module.get(prisma_service_1.PrismaService);
        jwtService = module.get(jwt_1.JwtService);
    });
    it('should be defined', () => {
        expect(service).toBeDefined();
    });
    describe('signUp', () => {
        it('should throw a ConflictException if user already exists', async () => {
            mockPrismaService.user.findUnique.mockResolvedValue({ id: '1', email: 'test@test.com' });
            await expect(service.signUp({ email: 'test@test.com', password: 'password' })).rejects.toThrow(common_1.ConflictException);
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
            await expect(service.login({ email: 'test@test.com', password: 'password' })).rejects.toThrow(common_1.UnauthorizedException);
        });
        it('should throw an UnauthorizedException if password does not match', async () => {
            const user = { id: '1', email: 'test@test.com', password: 'hashedPassword' };
            mockPrismaService.user.findUnique.mockResolvedValue(user);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));
            await expect(service.login({ email: 'test@test.com', password: 'wrongpassword' })).rejects.toThrow(common_1.UnauthorizedException);
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
//# sourceMappingURL=auth.service.spec.js.map