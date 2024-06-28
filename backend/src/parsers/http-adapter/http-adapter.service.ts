import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';

@Injectable()
export class HttpAdapter {
  constructor(private readonly httpService: HttpService) {}
  private readonly logger: Logger = new Logger(HttpAdapter.name);

  async getPage(link: string): Promise<any> {
    try {
      this.logger.log(`Http request: ${link}`);
      const res: AxiosResponse = await firstValueFrom(
        this.httpService.get(`${link}`, { fetchOptions: {} }),
      );
      return res.data;
    } catch (e) {
      this.logger.warn('Http request error: ' + e.message);
    }
  }
}
