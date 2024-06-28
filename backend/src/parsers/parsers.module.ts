import { BadRequestException, Global, Logger, Module } from '@nestjs/common';
import { ParsersController } from './parsers.controller';
import { RozetkaParserService } from './rozetka-parser/rozetka-parser.service';
import { TelemartParserService } from './telemart-parser/telemart-parser.service';
import { AxiosRetryModule } from 'nestjs-axios-retry';
import { HttpAdapter } from './http-adapter/http-adapter.service';
import { AxiosError } from 'axios';

@Global()
@Module({
  imports: [
    AxiosRetryModule.forRoot({
      axiosRetryConfig: {
        retries: 5,
        retryDelay: (): number => 20000,
        onRetry: (retryCount: number, error: AxiosError): void => {
          ParsersModule.logger.log(
            `Retrying request attempt ${retryCount}, ${error.message}`,
          );
        },
        onMaxRetryTimesExceeded: (error: AxiosError): void => {
          throw new BadRequestException(error.message);
        },
      },
    }),
  ],
  providers: [RozetkaParserService, TelemartParserService, HttpAdapter],
  controllers: [ParsersController],
  exports: [RozetkaParserService, TelemartParserService],
})
export class ParsersModule {
  private static readonly logger: Logger = new Logger(ParsersModule.name);
}
