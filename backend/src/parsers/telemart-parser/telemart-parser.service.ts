import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CheerioAPI, Element } from 'cheerio';
import { Item } from 'src/items/entities/item.entity';
import { Parser } from '../parser.interface';
import { ItemSource } from 'src/items/entities/item-source.enum';
import { HttpAdapter } from '../http-adapter/http-adapter.service';
import { ItemsService } from '../../items/items.service';
import { Category } from '../../items/dtos/category.dto';

@Injectable()
export class TelemartParserService implements Parser {
  private readonly batchSizeItemsToParse: number;
  private readonly batchSizePagesToParse: number;
  private readonly baseUrl: string = 'https://telemart.ua/ua';
  private readonly logger = new Logger(TelemartParserService.name);

  constructor(
    private readonly httpAdapter: HttpAdapter,
    private readonly itemsService: ItemsService,
  ) {
    this.batchSizePagesToParse = parseInt(
      process.env.TELEMART_BATCH_SIZE_PAGES_TO_PARSE,
    );
    this.batchSizeItemsToParse = parseInt(
      process.env.TELEMART_BATCH_SIZE_ITEMS_TO_PARSE,
    );
  }

  async startParsing(fullLoad: boolean): Promise<void> {
    this.logger.log('Start parsing Telemart');
    const $ = await this.httpAdapter.getCheerioApiPage(this.baseUrl);

    const categories = this.getCategories($);
    this.logger.log(`Start parsing categories`);

    for (const category of categories) {
      await this.parseCategory(category, fullLoad);
    }
  }

  private getCategories($: CheerioAPI): Category[] {
    return $('.catalog-box__item-link')
      .map((_, element: Element) => ({
        link: $(element).attr('href'),
        title: $(element).text().trim(),
      }))
      .get();
  }

  private async parseCategory(
    category: Category,
    fullLoad: boolean,
  ): Promise<void> {
    try {
      this.validateLink(category.link);
      this.logger.log(`Parsing category by link: ${category.link}`);
      const $ = await this.httpAdapter.getCheerioApiPage(category.link);
      const pagesCount = parseInt($('.page-item.last').text(), 10);

      if (Number.isNaN(pagesCount)) {
        const itemsBatch = this.mapItems($, category.title);
        if (fullLoad) {
          await this.loadFull(itemsBatch);
        }
        await this.itemsService.saveAll(itemsBatch);
        this.logger.log(`Parsed category by link: ${category.link}`);
        return;
      }

      for (let i = 1; i <= pagesCount; ) {
        const links = this.getBatchLinks(category.link, i, pagesCount);
        const itemsBatch = (
          await Promise.all(
            links.map((link) =>
              this.getItemsFromPage(link, fullLoad, category.title),
            ),
          )
        ).flat();

        await this.itemsService.saveAll(itemsBatch);

        i += this.batchSizePagesToParse;
      }

      this.logger.log(`Parsed category by link: ${category.link}`);
    } catch (error) {
      this.logger.warn(
        `Parsing error for category by link: ${category.link} - ${error.message}`,
      );
    }
  }

  private validateLink(link: string): void {
    if (!link.startsWith(this.baseUrl)) {
      throw new NotFoundException(link);
    }
  }

  private getBatchLinks(
    baseLink: string,
    start: number,
    end: number,
  ): string[] {
    const links = [];
    for (let j = 0; j < this.batchSizePagesToParse && start <= end; j++, start++) {
      links.push(`${baseLink}?page=${start}`);
    }
    return links;
  }

  private async getItemsFromPage(
    link: string,
    fullLoad: boolean,
    categoryTitle: string,
  ): Promise<Item[]> {
    const $ = await this.httpAdapter.getCheerioApiPage(link);
    const items = this.mapItems($, categoryTitle);

    if (fullLoad) {
      await this.loadFull(items);
    }

    this.logger.log(`Parsed ${items.length} items, page url: ${link}`);
    return items;
  }

  private mapItems($: CheerioAPI, categoryTitle: string): Item[] {
    return $('.product-item')
      .map((_, element: Element) => ({
        id: null,
        title: $(element).find('.product-item__title').text().trim(),
        link: $(element).find('.product-item__title a').attr('href'),
        description: this.getDescription($, element),
        price: this.getPrice($, element),
        type: categoryTitle,
        specifications: null,
        image: $(element).find('.product-item__pic__img img').attr('src'),
        source: ItemSource.TELEMART.toString(),
        subtitle: null,
      }))
      .get();
  }

  private getDescription($: CheerioAPI, element: Element): string {
    return $(element)
      .find('.product-short-char__item')
      .map((_, el) => {
        const label = $(el)
          .find('.product-short-char__item__label')
          .text()
          .trim();
        const value = $(el)
          .find('.product-short-char__item__value')
          .text()
          .trim();
        return `${label} ${value}`;
      })
      .get()
      .join(', ');
  }

  private getPrice($: CheerioAPI, element: Element): number {
    const priceText = $(element)
      .find('.product-cost_new')
      .text()
      .replace(/\s+/g, '')
      .replace(',', '.');
    return parseInt(priceText, 10) || 0;
  }

  private async loadFull(items: Item[]): Promise<void> {
    for (let i = 0; i < items.length; i += this.batchSizeItemsToParse) {
      const itemsBatch = items.slice(i, i + this.batchSizeItemsToParse);
      await Promise.all(itemsBatch.map((item) => this.setSpecification(item)));
    }
  }

  private async setSpecification(item: Item): Promise<void> {
    const $ = await this.httpAdapter.getCheerioApiPage(item.link);
    const specifications = {};

    $('.card-block__specific-header').each((_, header) => {
      const categoryTitle = $(header)
        .find('.card-block__specific-col')
        .text()
        .trim();
      const category = {};

      const rows = $(header).nextUntil(
        '.card-block__specific-header',
        '.card-block__specific-row',
      );
      rows.each((_, row) => {
        const key = $(row)
          .find('.card-block__specific-col')
          .first()
          .text()
          .trim();
        const value = $(row)
          .find('.card-block__specific-col')
          .last()
          .text()
          .trim();
        category[key] = value;
      });

      specifications[categoryTitle] = category;
    });

    item.specifications = JSON.stringify(specifications);
  }
}
