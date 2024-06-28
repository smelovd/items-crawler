import { Module } from '@nestjs/common';
import { ItemsModule } from './items/items.module';
import { DatasourceModule } from './datasource/datasource.module';
import { ParsersModule } from './parsers/parsers.module';

@Module({
  imports: [DatasourceModule, ItemsModule, ParsersModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
