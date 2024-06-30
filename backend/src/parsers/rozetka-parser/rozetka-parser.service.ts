import { Injectable, Logger } from '@nestjs/common';
import { Item } from 'src/items/entities/item.entity';
import { CheerioAPI, Element } from 'cheerio';
import { Parser } from '../parser.interface';
import { ItemSource } from 'src/items/entities/item-source.enum';
import { HttpAdapter } from '../http-adapter/http-adapter.service';
import { ItemsService } from 'src/items/items.service';
import { Category } from '../../items/dtos/category.dto';

@Injectable()
export class RozetkaParserService implements Parser {
  private readonly batchPageSize: number = parseInt(
    process.env.BATCH_PAGE_SIZE,
  );
  private readonly batchSize: number = parseInt(process.env.BATCH_SIZE);
  private readonly baseUrl: string = 'https://rozetka.com.ua/';
  private readonly logger = new Logger(RozetkaParserService.name);

  constructor(
    private readonly httpAdapter: HttpAdapter,
    private readonly itemsService: ItemsService,
  ) {}

  async startParsing(fullLoad: boolean): Promise<void> {
    this.logger.log(`Start parsing rozetka`);

    const categories: Category[] = await this.getAllCategories();

    this.logger.log(`Start parsing categories`);
    for (const category of categories) {
      await this.parseCategory(category, fullLoad);
    }
  }

  private async getAllCategories(): Promise<Category[]> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      this.baseUrl,
    );
    const categoryLinks: string[] = this.extractLinks(
      $,
      '.menu-categories__item .menu-categories__link',
    );

    const categories = await Promise.all(
      categoryLinks.map(async (link: string) => {
        const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(link);
        return $('.portal-grid__cell .tile-cats__heading')
          .map((_, element) => ({
            link: $(element).attr('href'),
            title: $(element).text().trim(),
          }))
          .get();
      }),
    );
    return categories.flat();
  }

  private extractLinks($: CheerioAPI, selector: string): string[] {
    return $(selector)
      .map((_: number, element: Element) => $(element).attr('href'))
      .get();
  }

  private async parseCategory(
    category: Category,
    fullLoad: boolean,
  ): Promise<void> {
    this.logger.log(`Parsing category by link: ${category.link}`);
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      category.link,
    );
    const pagesCount: number = parseInt($('.pagination__link').text());

    for (let i: number = 1; i <= pagesCount; ) {
      const links: string[] = this.getBatchLinks(category.link, i, pagesCount);

      const itemsBatch: Item[] = (
        await Promise.all(
          links.map((link: string) =>
            this.getItemsFromPage(link, fullLoad, category.title),
          ),
        )
      ).flat();
      this.logger.log(
        `Parsed ${links.length} pages, ${itemsBatch.length} items`,
      );
      await this.itemsService.saveAll(itemsBatch);

      i += this.batchSize;
    }
    this.logger.log(`Parsed category by link: ${category.link}`);
  }

  private getBatchLinks(
    baseLink: string,
    start: number,
    end: number,
  ): string[] {
    const links = [];
    for (let j = 0; j < this.batchSize && start <= end; j++, start++) {
      links.push(`${baseLink}page=${start}`);
    }
    return links;
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

    this.logger.log(`Parsed ${items.length} items, page link: ${link}`);
    return items;
  }

  private mapItems($: CheerioAPI, categoryTitle: string): Item[] {
    return $('.goods-tile__inner')
      .map((_, element: Element): Item => {
        return {
          id: null,
          title: $(element).find('.goods-tile__title').text().trim(),
          link: $(element).find('.product-link').attr('href'),
          description: null,
          price: this.extractPrice(
            $(element).find('.goods-tile__price-value').text(),
          ),
          specifications: null,
          type: categoryTitle,
          image: $(element).find('.goods-tile__picture img').attr('src'),
          source: ItemSource.ROZETKA.toString(),
          subtitle: null,
        };
      })
      .get();
  }

  private extractPrice(priceText: string): number {
    return parseFloat(
      priceText.replace(/[^.\d]+/g, '').replace(/^([^.]*\.)|\./g, '$1'),
    );
  }

  private async loadFull(items: Item[]): Promise<void> {
    for (let i: number = 0; i < items.length; i += this.batchPageSize) {
      const itemsBatch: Item[] = items.slice(i, i + this.batchPageSize);

      await Promise.all(
        itemsBatch.map((item) =>
          Promise.all([
            this.setSpecification(item),
            this.setDescriptionAndImage(item),
          ]),
        ),
      );
    }
  }

  private async setDescriptionAndImage(item: Item): Promise<void> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(item.link);
    item.image = this.extractImage($, '.picture-container__picture');
    item.description = this.extractDescription(
      $,
      '.product-about__description-content',
      '.rz-c__content',
    );
  }

  private extractDescription(
    $: CheerioAPI,
    descriptionSelector: string,
    richTextSelector: string,
  ): string {
    const description = $(descriptionSelector).text().trim();
    if (description) {
      return description;
    }
    const richDescriptions = $(richTextSelector)
      .map((_, element: Element) => $(element).text().trim())
      .get();
    return richDescriptions.length > 0 ? richDescriptions.join(' ') : '';
  }

  private extractImage($: CheerioAPI, selector: string): string {
    return $(selector).attr('src');
  }

  private async setSpecification(item: Item): Promise<void> {
    const $: CheerioAPI = await this.httpAdapter.getCheerioApiPage(
      `${item.link}characteristics/`,
    );
    item.specifications = this.extractSpecification($, '.item');
  }

  private extractSpecification($: CheerioAPI, selector: string): string {
    const specifications = {};
    $(selector).each((_, element: Element) => {
      const label = $(element).find('.label span').text().trim();
      specifications[label] = $(element).find('.sub-list li').text().trim();
    });
    return JSON.stringify(specifications);
  }
}
