import PostgresEngine from './engine.js'; 
import { Document } from "@langchain/core/documents"; 
import { BaseDocumentLoader } from '@langchain/core/document_loaders/base';

// Options for PostgresLoader
export interface PostgresLoaderOptions {
  tableName?: string;
  schemaName?: string;
  contentColumns?: string[];
  metadataColumns?: string[];
  format?: "text" | "json" | "yaml" | "csv";
  query?: string;
}

// Options for PostgresDocumentSaver
export interface PostgresDocumentSaverOptions {
  tableName?: string;
  schemaName?: string;
  contentColumn?: string;
  metadataColumns?: string[];
  metadataJsonColumn?: string;

}

export class PostgresLoader extends BaseDocumentLoader {
    
    private engine: PostgresEngine;
    private options: PostgresLoaderOptions;
  
    constructor(engine: PostgresEngine, options: PostgresLoaderOptions) {
      super();
      this.engine = engine;
      this.options = options;
    }
  
    static async create(engine: PostgresEngine, options: PostgresLoaderOptions): Promise<PostgresLoader> {
      return new PostgresLoader(engine, options);
    }
  

    async load(): Promise<Document[]> {
      throw new Error('Method not implemented.');
    }
  }