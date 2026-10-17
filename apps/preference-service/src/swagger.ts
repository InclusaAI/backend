import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle("Preference Service API")
    .setDescription(
      "Per-participant accessibility preferences. Preferences belong to the " +
        "participant and persist across sessions and organizations.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, options);

  // Machine-readable spec, for frontend client generation.
  app.getHttpAdapter().get("/api/openapi.json", (req, res) => {
    res.json(document);
  });

  SwaggerModule.setup("/api/docs", app, document, {
    customSiteTitle: "Preference Service API Docs",
  });
}
