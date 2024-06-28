export interface Parser {
  startParsing(fullLoad: boolean): Promise<void>;
}
