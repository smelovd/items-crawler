import { Controller, Get, Logger, Query } from '@nestjs/common';
import { RozetkaParserService } from './rozetka-parser/rozetka-parser.service';
import { TelemartParserService } from './telemart-parser/telemart-parser.service';

@Controller('parsers')
export class ParsersController {
  constructor(
    private readonly telemartParserService: TelemartParserService,
    private readonly rozetkaParserService: RozetkaParserService,
  ) {}
  private readonly logger = new Logger(ParsersController.name);

  @Get('rozetka')
  async rozetkaParserStart(@Query('fullLoad') fullLoad: boolean): Promise<void> {
    this.logger.log('Start parsing rozetka');
    this.rozetkaParserService.startParsing(fullLoad);
  }

  @Get('telemart')
  async telemartParserStart(@Query('fullLoad') fullLoad: boolean): Promise<void> {
    this.logger.log('Start parsing telemart');
    this.telemartParserService.startParsing(fullLoad);
  }
}
