import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const options = new DocumentBuilder()
    .setTitle('Fanout Service API')
    .setDescription('API for handling real-time event fan-out via WebSockets.')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, options);

  // Endpoint for the machine-readable OpenAPI spec
  app.getHttpAdapter().get('/api/openapi.json', (req, res) => {
    res.json(document);
  });

  // Endpoint for the interactive Scalar UI
  SwaggerModule.setup('/api/docs', app, document, {
    customSiteTitle: 'Fanout Service API Docs',
    scalarOptions: {},
  });
}