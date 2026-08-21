import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('Identity Service API')
    .setDescription('API for managing user identity, authentication, and profiles.')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, options);

  // Endpoint for the machine-readable OpenAPI spec
  app.getHttpAdapter().get('/api/openapi.json', (req, res) => {
    res.json(document);
  });

  // Endpoint for the interactive Scalar UI
  SwaggerModule.setup('/api/docs', app, document, {
    customSiteTitle: 'Identity Service API Docs',
    scalarOptions: {},
  });
}