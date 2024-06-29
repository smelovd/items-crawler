import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import cheerio, { CheerioAPI } from 'cheerio';

@Injectable()
export class HttpAdapter {
  constructor(private readonly httpService: HttpService) {}
  private readonly logger: Logger = new Logger(HttpAdapter.name);

  async getPage(link: string): Promise<any> {
    try {
      const res: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${link}`, {
          // timeout: 20000,
        }),
      );
      return res.data;
    } catch (error) {
      this.logger.warn('Http request error: ' + error);
    }
  }

  async getCheerioApiPage(link: any): Promise<CheerioAPI> {
    return cheerio.load(await this.getPage(link));
  }
}
