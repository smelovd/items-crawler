import { Global, Logger, Module } from '@nestjs/common';
import { ParsersController } from './parsers.controller';
import { RozetkaParserService } from './rozetka-parser/rozetka-parser.service';
import { TelemartParserService } from './telemart-parser/telemart-parser.service';
import { AxiosRetryModule } from 'nestjs-axios-retry';
import { HttpAdapter } from './http-adapter/http-adapter.service';
import { AxiosError } from 'axios';
import { ParsersService } from './parsers.service';

@Global()
@Module({
  imports: [
    AxiosRetryModule.forRoot({
      axiosRetryConfig: {
        retries: 5,
        shouldResetTimeout: true,
        retryDelay: (): number => 10000,
        onRetry: (retryCount: number, error: AxiosError): void => {
          ParsersModule.logger.warn(
            `Retrying request attempt ${retryCount}, ${error.message}`,
          );
        },
        retryCondition: (_) => true,
      },
    }),
  ],
  providers: [
    RozetkaParserService,
    TelemartParserService,
    HttpAdapter,
    ParsersService,
  ],
  controllers: [ParsersController],
  exports: [RozetkaParserService, TelemartParserService],
})
export class ParsersModule {
  private static readonly logger: Logger = new Logger(ParsersModule.name);
}
