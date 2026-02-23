import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const enableSwagger = process.env.SWAGGER_ENABLED !== 'false';
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Doriv API')
      .setDescription('Doriv Backend API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const defaultCorsOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const envCorsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
  const corsOrigin = Array.from(
    new Set([...defaultCorsOrigins, ...envCorsOrigins]),
  );

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
