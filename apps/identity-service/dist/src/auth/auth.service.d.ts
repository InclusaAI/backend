import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
export declare class AuthService {
    private readonly prisma;
    private readonly jwtService;
    constructor(prisma: PrismaService, jwtService: JwtService);
    signUp(signUpDto: SignUpDto): Promise<{
        accessToken: string;
    }>;
    login(loginDto: LoginDto): Promise<{
        accessToken: string;
    }>;
}
