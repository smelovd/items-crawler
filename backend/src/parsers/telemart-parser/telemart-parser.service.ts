import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cheerio, CheerioAPI, Element } from 'cheerio';
import { Item } from 'src/items/entities/item.entity';
import { Parser } from '../parser.interface';
import { ItemSource } from 'src/items/entities/item-source.enum';
import { HttpAdapter } from '../http-adapter/http-adapter.service';
import { ItemsService } from '../../items/items.service';
import { Category } from '../../items/dtos/category.dto';

@Injectable()
export class TelemartParserService implements Parser {
  constructor(
    private readonly httpAdapter: HttpAdapter,
    private readonly itemsService: ItemsService,
  ) {}
  private readonly batchPageSize: number = parseInt(process.env.BATCH_PAGE_SIZE);
  private readonly batchSize: number = parseInt(process.env.BATCH_SIZE) * 2;
  private readonly baseUrl: string = 'https://telemart.ua/ua';
  private readonly logger: Logger = new Logger(TelemartParserService.name);

  async startParsing(fullLoad: boolean): Promise<void> {
    this.logger.log(`Start parsing telemart`);
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      `${this.baseUrl}`,
    );

    const categories: Category[] = this.getCategories($);
    this.logger.log(
      `Start parsing categories ${fullLoad ? `with` : `without`} specification`,
    );

    for (let i: number = 0; i < categories.length; i++) {
      await this.parseCategory(categories[i], fullLoad);
    }
  }

  private getCategories($: CheerioAPI): Category[] {
    return $('.catalog-box__item-link')
      .map((_: number, element: Element): Category => {
        const link: string = $(element).attr('href');
        const title: string = $(element).text().trim();
        return { title, link };
      })
      .get();
  }

  private async parseCategory(
    category: Category,
    fullLoad: boolean,
  ): Promise<void> {
    try {
      this.validateLink(category.link);
      this.logger.log(`Parsing category by link: ${category.link}`);
      const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
        category.link,
      );
      const pagesCount: number = parseInt($('.page-item.last').text());

      if (Number.isNaN(pagesCount)) {
        const itemsBatch: Item[] = this.mapItems($, category.title);
        if (fullLoad) {
          await this.loadFull(itemsBatch);
        }

        await this.itemsService.saveAll(itemsBatch);
        this.logger.log(`Parsed category by link: ${category.link}`);
        return;
      }

      for (let i: number = 1; i <= pagesCount; i++) {
        const links: string[] = [];

        for (
          let j: number = 0;
          j < this.batchSize && i <= pagesCount;
          j++, i++
        ) {
          links.push(`${category.link}?page=${i}`);
        }

        const itemsBatch: Item[] = (
          await Promise.all(
            links.map((link: string): Promise<Item[]> =>
                this.getItemsFromPage(link, fullLoad, category.title),
            ),
          )
        ).flat();

        await this.itemsService.saveAll(itemsBatch);
      }

      this.logger.log(`Parsed category by link: ${category.link}`);
    } catch (e) {
      this.logger.warn(
        `Parsing error category by link: ${category.link} ${e.message}`,
      );
    }
  }

  private validateLink(link: string): void {
    if (!link.startsWith(this.baseUrl)) {
      throw new NotFoundException(link);
    }
  }

  private async getItemsFromPage(
    link: string,
    fullLoad: boolean,
    categoryTitle: string,
  ): Promise<Item[]> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(link);
    const items: Item[] = this.mapItems($, categoryTitle);

    if (fullLoad) {
      await this.loadFull(items);
    }

    this.logger.log(
      `Parsed ${items.length} items ${fullLoad ? `with` : `without`} full load, page url: ${link}`,
    );
    return items;
  }

  private mapItems($: CheerioAPI, categoryTitle: string): Item[] {
    return $('.product-item')
      .map((_: number, element: Element): Item => {
        return {
          id: null,
          title: $(element).find('.product-item__title').text().trim(),
          link: $(element).find('.product-item__title a').attr('href'),
          description: this.getDescription($, element),
          price: Number.isNaN(this.getPrice($, element))
            ? 0
            : this.getPrice($, element),
          type: categoryTitle,
          specifications: null,
          image: $(element).find('.product-item__pic__img img').attr('src'),
          source: ItemSource.TELEMART.toString(),
          subtitle: null,
        };
      })
      .filter(Boolean)
      .get();
  }

  private getDescription($: CheerioAPI, element: Element): string {
    const description = [];
    $(element)
      .find('.product-short-char__item')
      .each((_: number, element: Element) => {
        const label: string = $(element)
          .find('.product-short-char__item__label')
          .text()
          .trim();
        const value: string = $(element)
          .find('.product-short-char__item__value')
          .text()
          .trim();
        description.push(`${label} ${value}`);
      });
    return description.join(', ');
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

  private async loadFull(items: Item[]): Promise<void> {
    for (let i: number = 0; i < items.length; i += this.batchPageSize) {
      const itemsBatch: Item[] = items.copyWithin(i, i + this.batchPageSize);

      await Promise.all(
        itemsBatch.map((item: Item) => this.setSpecification(item)),
      );
    }
  }

  private async setSpecification(item: Item): Promise<void> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      `${item.link}`,
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
}
