import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import cheerio, { Cheerio, CheerioAPI, Element } from 'cheerio';
import { Item } from 'src/items/entities/item.entity';
import { Parser } from '../parser.interface';
import { ItemSource } from 'src/items/entities/item-source.enum';
import { HttpAdapter } from '../http-adapter/http-adapter.service';
import { ItemsService } from '../../items/items.service';

@Injectable()
export class TelemartParserService implements Parser {
  constructor(
    private readonly httpAdapter: HttpAdapter,
    private readonly itemsService: ItemsService,
  ) {}
  private static readonly baseUrl: string = 'https://telemart.ua/ua';
  private readonly logger: Logger = new Logger(TelemartParserService.name);

  async startParsing(fullLoad: boolean): Promise<void> {
    const $: CheerioAPI = cheerio.load(
      await this.httpAdapter.getPage(`${TelemartParserService.baseUrl}`),
    );
    const categorieslinks: string[] = this.getCategoriesLinks($);

    this.logger.log(`Found all categories`);
    this.logger.log(
      `Start parsing categories ${fullLoad ? `with` : `without`} specification`,
    );

    for (let i: number = 0; i < categorieslinks.length; i++) {
      await this.parseCategory(categorieslinks[i], fullLoad);
    }
  }

  private getCategoriesLinks($: CheerioAPI): string[] {
    return $('.catalog-box__item-link')
      .map((_, element) => $(element).attr('href'))
      .get()
      .filter(Boolean);
  }

  private async parseCategory(link: string, fullLoad: boolean): Promise<void> {
    try {
      this.validateLink(link);
      this.logger.log(`Parsing category by link: ${link}`);
      const $: CheerioAPI = cheerio.load(await this.httpAdapter.getPage(link));
      const pagesCount: number = parseInt($('.page-item.last').text());

      if (Number.isNaN(pagesCount)) {
        const itemsBatch: Item[] = this.getItems($, link);
        await this.itemsService.saveAll(itemsBatch);
        this.logger.log(`Parsed category by link: ${link}`);
        return;
      }

      for (let i: number = 1; i <= pagesCount; i++) {
        const links: string[] = [];

        if (fullLoad) {
          const pageItems: Item[] = await this.getItemsFromPage(link, fullLoad);
          await this.itemsService.saveAll(pageItems);
          this.logger.log(`Parsed category by link: ${link}`);
          continue;
        }

        for (let j: number = 0; j < 10 && i <= pagesCount; j++, i++) {
          links.push(`${link}?page=${i}`);
        }

        const itemsBatch: Item[] = (
          await Promise.all(
            links.map(
              async (link: string): Promise<Item[]> =>
                await this.getItemsFromPage(link, fullLoad),
            ),
          )
        ).flat();
        this.logger.log(
          `Parsed ${links.length} pages, ${itemsBatch.length} items`,
        );
        await this.itemsService.saveAll(itemsBatch);
      }

      this.logger.log(`Parsed category by link: ${link}`);
    } catch (e) {
      this.logger.warn(`Parsing error category by link: ${link} ${e.message}`);
    }
  }

  private async getItemsFromPage(
    link: string,
    fullLoad: boolean,
  ): Promise<Item[]> {
    const $: CheerioAPI = cheerio.load(await this.httpAdapter.getPage(link));
    const items: Item[] = this.getItems($, link);

    if (fullLoad) {
      await this.setSpecifications(items);
    }

    this.logger.log(
      `Parsed ${items.length} items ${fullLoad ? `with` : `without`} full load, page url: ${link}`,
    );
    return items;
  }

  private getItems($: CheerioAPI, url: string): Item[] {
    return $('.product-item')
      .map((_, element) =>
        !Number.isNaN(this.getPrice($, element))
          ? this.createItem($, element, url)
          : null,
      )
      .filter(Boolean)
      .get();
  }

  private createItem($: CheerioAPI, element: Element, url: string): Item {
    return {
      id: null,
      title: $(element).find('.product-item__title').text().trim(),
      link: $(element).find('.product-item__title a').attr('href'),
      description: this.getDescription($, element),
      price: this.getPrice($, element),
      specifications: null,
      type: url.split('/')[0],
      image: $(element).find('.product-item__pic__img img').attr('src'),
      source: ItemSource.TELEMART.toString(),
      subtitle: null,
    };
  }

  private getDescription($: CheerioAPI, element: Element): string {
    const description = {};
    $(element)
      .find('.product-short-char__item')
      .each((_: number, element: Element) => {
        const label: string = $(element)
          .find('.product-short-char__item__label')
          .text()
          .trim();
        description[label] = $(element)
          .find('.product-short-char__item__value')
          .text()
          .trim();
      });
    return JSON.stringify(description);
  }

  private getPrice($: CheerioAPI, element: Element): number {
    return parseInt(
      $(element)
        .find('.product-cost')
        .text()
        .replace(/\s+/g, '')
        .replace(',', '.'),
    );
  }

  private async setSpecifications(items: Item[]): Promise<void> {
    for (let i: number = 0; i < items.length; i += 10) {
      const itemsBatch: Item[] = items.slice(i, i + 10);

      await Promise.all(
        itemsBatch.map(async (item: Item): Promise<void> => {
          await this.setSpecification(item);
        }),
      );
    }
  }

  private async setSpecification(item: Item): Promise<void> {
    const $: CheerioAPI = cheerio.load(
      await this.httpAdapter.getPage(`${item.link}characteristics/`),
    );
    const specifications = {};

    $('.card-block__specific-header').each(
      (_: number, header: Element): void => {
        const categoryTitle: string = $(header)
          .find('.card-block__specific-col')
          .text()
          .trim();
        const category = {};

        const nextRow: Cheerio<Element> = $(header).nextUntil(
          '.card-block__specific-header',
          '.card-block__specific-row',
        );

        nextRow.each((_: number, row: Element): void => {
          const key: string = $(row)
            .find('.card-block__specific-col')
            .first()
            .text()
            .trim();
          category[key] = $(row)
            .find('.card-block__specific-col')
            .last()
            .text()
            .trim();
        });
        specifications[categoryTitle] = category;
      },
    );
    item.specifications = JSON.stringify(specifications);
  }

  private validateLink(link: string): void {
    if (!link.startsWith(TelemartParserService.baseUrl)) {
      throw new NotFoundException(link);
    }
  }
}
