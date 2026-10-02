// apps/api/src/main.ts
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const webOrigin = config.getOrThrow<string>('webOrigin');
  app.enableCors({
    origin: [webOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  if (config.getOrThrow<string>('nodeEnv') !== 'production') {
    const swaggerCfg = new DocumentBuilder()
      .setTitle('Mizan ERP API')
      .setDescription('Multi-tenant SaaS ERP for MENA — MVP')
      .setVersion('1.0')
      .addBearerAuth(
        { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        'access-token',
      )
      .build();
    const doc = SwaggerModule.createDocument(app, swaggerCfg);
    SwaggerModule.setup('docs', app, doc);
  }

  const port = config.getOrThrow<number>('port');
  await app.listen(port);
  logger.log(`🚀 Mizan API → http://localhost:${port}/api/v1`);
  if (config.getOrThrow<string>('nodeEnv') !== 'production') {
    logger.log(`📚 Swagger → http://localhost:${port}/docs`);
  }
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
