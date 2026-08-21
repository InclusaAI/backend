import { Injectable } from "@nestjs/common";
import { User } from "@inclusaai/shared-types";

@Injectable()
export class AppService {
  getHealth(): string {
    return "OK";
  }

  getUser(): User {
    return {
      id: "123",
      email: "test@example.com",
      name: "Test User",
    };
  }
}