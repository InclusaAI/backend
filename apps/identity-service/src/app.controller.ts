import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("Health")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("/healthz")
  @ApiOperation({
    summary: "Health Check",
    description: 'Responds with "OK" if the service is running.',
  })
  @ApiResponse({
    status: 200,
    description: "Service is healthy.",
    type: String,
  })
  getHealth(): string {
    return this.appService.getHealth();
  }
}
