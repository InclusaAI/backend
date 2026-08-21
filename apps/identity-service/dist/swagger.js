"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupSwagger = void 0;
const swagger_1 = require("@nestjs/swagger");
function setupSwagger(app) {
    const options = new swagger_1.DocumentBuilder()
        .setTitle('Identity Service API')
        .setDescription('API for managing user identity, authentication, and profiles.')
        .setVersion('1.0')
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, options);
    app.getHttpAdapter().get('/api/openapi.json', (req, res) => {
        res.json(document);
    });
    swagger_1.SwaggerModule.setup('/api/docs', app, document, {
        customSiteTitle: 'Identity Service API Docs',
        scalarOptions: {},
    });
}
exports.setupSwagger = setupSwagger;
//# sourceMappingURL=swagger.js.map