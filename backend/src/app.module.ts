import { Module } from '@nestjs/common';
import { ItemsModule } from './items/items.module';
import { DatasourceModule } from './datasource/datasource.module';
import { ParsersModule } from './parsers/parsers.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    DatasourceModule,
    ItemsModule,
    ParsersModule,
    ConfigModule.forRoot(),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
