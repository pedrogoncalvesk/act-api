import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import {
  DocumentBuilder,
  SwaggerDocumentOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import compress from 'fastify-compress';
import helmet from 'fastify-helmet';

import { AppModule } from './app.module';
import { Env } from './commons/environment/env';
import { LoggingInterceptor } from './commons/interceptors/logging.interceptor';

const bootstrap = async (): Promise<void> => {
  const fastifyAdapter = new FastifyAdapter({
    logger: false,
    maxParamLength: 1000,
    bodyLimit: 12485760, // 10MB
  });

  fastifyAdapter.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [`'self'`],
        styleSrc: [`'self'`, `'unsafe-inline'`],
        imgSrc: [`'self'`, 'data:', 'validator.swagger.io'],
        scriptSrc: [`'self'`, `https: 'unsafe-inline'`],
      },
    },
  });
  fastifyAdapter.register(compress);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    fastifyAdapter,
  );

  app.enableCors({
    origin: false,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    preflightContinue: false,
    optionsSuccessStatus: 200,
  } as CorsOptions);

  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  app.useGlobalInterceptors(new LoggingInterceptor());

  const swaggerDocumentBuilder = new DocumentBuilder()
    .addBearerAuth()
    .setTitle(Env.SWAGGER_TITLE)
    .setDescription(Env.SWAGGER_DESCRIPTION)
    .setVersion(Env.APPLICATION_VERSION)
    .addServer(Env.SWAGGER_SERVER)
    .setContact('ActEdu', 'http://www.actedu.com.br', 'contato@actedu.com.br')
    .build();

  const swaggerDocumentOptions: SwaggerDocumentOptions = {
    operationIdFactory: (_controllerKey: string, methodKey: string) =>
      methodKey,
  };

  const swaggerDocument = SwaggerModule.createDocument(
    app,
    swaggerDocumentBuilder,
    swaggerDocumentOptions,
  );

  SwaggerModule.setup(Env.SWAGGER_DOCS, app, swaggerDocument);

  const port = parseInt(Env.APPLICATION_PORT.toString(), 10);

  await app
    .listen(port, '0.0.0.0')
    .then(() => Logger.log(`API Listen on ${port}`))
    .catch((error: any) => Logger.error(error.message));
};

bootstrap();
