import PostgresEngine from './engine.js'; 
import { Document } from "@langchain/core/documents"; 
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';
import { textFormatter, csvFormatter, yamlFormatter, jsonFormatter } from './utils/utils.js';

const DEFAULT_METADATA_COL = "langchain_metadata";
type Row = { [key: string]: any };

// Options for PostgresLoader
export interface PostgresLoaderOptions {
  tableName?: string;
  schemaName?: string;
  contentColumns?: string[];
  metadataColumns?: string[];
  format?: "text" | "json" | "yaml" | "csv";
  formatter?: (row: Row, contentColumns: string[]) => string;
  query?: string;
  metadataJsonColumn?: string | null;
}


function parseDocFromRow(
    contentColumns: string[],
    metadataColumns: string[],
    row: Row,
    metadataJsonColumn: string | null = DEFAULT_METADATA_COL,
    formatter: (row: Row, contentColumns: string[]) => string = textFormatter
): Document {
    const pageContent = formatter(row, contentColumns);
    const metadata: { [key: string]: any } = {};

    if (metadataJsonColumn && row[metadataJsonColumn]) {
        Object.entries(row[metadataJsonColumn]).forEach(([k, v]) => {
            metadata[k] = v;
        });
    }

    metadataColumns.forEach(column => {
        if (column in row && column !== metadataJsonColumn) {
            metadata[column] = row[column];
        }
    });


    return { pageContent, metadata };
}

export class PostgresLoader extends BaseDocumentLoader {

    private engine: PostgresEngine;
    tableName?: string;
    schemaName?: string = "public";
    contentColumns?: string[];
    metadataColumns?: string[];
    format?: "text" | "json" | "yaml" | "csv";
    formatter?: (row: Row, contentColumns: string[]) => string;
    query?: string;
    metadataJsonColumn?: string | null;
  
    constructor(engine: PostgresEngine, options: PostgresLoaderOptions) {
      super();
      this.engine = engine;
      this.tableName = options.tableName;
      this.schemaName = options.schemaName;
      this.contentColumns = options.contentColumns;
      this.metadataColumns = options.metadataColumns;
      this.format = options.format;
      this.query = options.query;
      this.formatter = options.formatter;
      this.metadataJsonColumn = options.metadataJsonColumn;
    }

    static async create(engine: PostgresEngine, {schemaName, tableName, contentColumns, metadataColumns, format, query, formatter, metadataJsonColumn}: PostgresLoaderOptions): Promise<PostgresLoader> {

      if (tableName && query) {
        throw new Error("Only one of 'table_name' or 'query' should be specified.");
      }
      if (!tableName && !query) {
        throw new Error("At least one of the parameters 'table_name' or 'query' needs to be provided");
      }
      if (format && formatter) {
        throw new Error("Only one of 'format' or 'formatter' should be specified.");
      }

      if (format && !["csv", "text", "json", "yaml"].includes(format)) {
        throw new Error("format must be type: 'csv', 'text', 'json', 'yaml'");
      }

      if (formatter !== undefined) {
      } else if (format === "csv") {
        formatter = csvFormatter;
      } else if (format === "yaml") {
        formatter = yamlFormatter;
      } else if (format === "json") {
        formatter = jsonFormatter;
      } else {
        formatter = textFormatter;
      }

      if (!query) {
        query = `SELECT * FROM "${schemaName}"."${tableName}"`;
      }

      try {
        const result = await engine.pool.raw(query);
        const columnNames = result.fields.map((field: { name: any; }) => field.name);

        contentColumns = contentColumns || [columnNames[0]];
        metadataColumns = metadataColumns || columnNames.filter((col: string) => !contentColumns.includes(col));

        if (metadataJsonColumn && !columnNames.includes(metadataJsonColumn)) {
            throw new Error(`Column ${metadataJsonColumn} not found in query result ${columnNames}.`);
        }

        if (!metadataJsonColumn && columnNames.includes(DEFAULT_METADATA_COL)) {
            metadataJsonColumn = DEFAULT_METADATA_COL;
        }

        const allNames = [...(contentColumns || []), ...(metadataColumns || [])];
        allNames.forEach(name => {
            if (!columnNames.includes(name)) {
                throw new Error(`Column ${name} not found in query result ${columnNames}.`);
            }
        });

        return new PostgresLoader(engine, {schemaName, tableName, contentColumns, metadataColumns, format, query, formatter, metadataJsonColumn});
         
    } catch (error: any) {
      throw Error(error);
    }
  }

  async load(): Promise<Document[]> {
    const documents: Document[] = [];
      for await (const doc of this.lazyLoad()) {
          documents.push(doc);
      }
      return documents;
  }

  async *lazyLoad(): AsyncGenerator<Document> {
    let { query, contentColumns, metadataColumns, formatter, metadataJsonColumn, schemaName, tableName } = this;
    try {
      const result = await this.engine.pool.raw(query);

      for (const row of result.rows) {
          const rowData: Row = {};
          const columnNames = [...(contentColumns || []), ...(metadataColumns || [])];
          if (metadataJsonColumn) {
              columnNames.push(metadataJsonColumn);
          }
          columnNames.forEach(column => {
              rowData[column] = row[column];
          });

          yield parseDocFromRow(
              contentColumns || [],
              metadataColumns || [],
              rowData,
              metadataJsonColumn,
              formatter
          );
      }
    } catch (error: any) {
      throw Error(error);
    }

  }
}
