import { Embeddings, EmbeddingsInterface } from "@langchain/core/embeddings";
import PostgresEngine from "./engine.js";
import { DEFAULT_DISTANCE_STRATEGY, DistanceStrategy, QueryOptions } from "./indexes.js";
import { VectorStore } from "@langchain/core/vectorstores";
import { DocumentInterface } from "@langchain/core/documents";

export interface PostgresVectorStoreArgs {
  schemaName?: string,
  contentColumn?: string,
  embeddingColumn?: string,
  metadataColumns?: Array<string>,
  idColumn?: string,
  distanceStrategy?: DistanceStrategy,
  k?: Number,
  fetch_k?: Number,
  lambdaMult?: Number,
  ignoreMetadataColumns?: Array<string>, //optional
  metadataJsonColumn?: string, // optional
  indexQueryOptions?: QueryOptions // optional
}

class PostgresVectorStore extends VectorStore {
  engine: PostgresEngine;
  embeddings: EmbeddingsInterface;
  tableName: string;
  schemaName: string;
  contentColumn: string;
  embeddingColumn: string;
  metadataColumns: Array<string>;
  ignoreMetadataColumns: Array<string>;
  idColumn: string;
  metadataJsonColumn: string;
  distanceStrategy: DistanceStrategy;
  k: Number;
  fetch_k: Number;
  lambdaMult: Number;
  indexQueryOptions: QueryOptions;

  /**
   * Initializes a new vector store with embeddings and database configuration.
   *
   * @param embeddings - Instance of `EmbeddingsInterface` used to embed queries.
   * @param dbConfig - Configuration settings for the database or storage system.
   */
   constructor(embeddings: EmbeddingsInterface, dbConfig: Record<string, any>) {
    super(embeddings, dbConfig);
    this.embeddings = embeddings;
  }

  /**
   * Create a new PostgresVectorStore instance.
   * @param {PostgresEngine} engine Required - Connection pool engine for managing connections to Cloud SQL for PostgreSQL database.
   * @param {Embeddings} embeddings Required - Text embedding model to use.
   * @param {string} tableName Required - Name of an existing table or table to be created.
   * @param {string} schemaName Database schema name of the table. Defaults to "public".
   * @param {string} contentColumn Column that represent a Document's page_content. Defaults to "content".
   * @param {string} embeddingColumn Column for embedding vectors. The embedding is generated from the document value. Defaults to "embedding".
   * @param {Array<string>} metadataColumns Column(s) that represent a document's metadata.
   * @param {Array<string>} ignoreMetadataColumns Optional - Column(s) to ignore in pre-existing tables for a document's metadata. Can not be used with metadata_columns.
   * @param {string} idColumn Column that represents the Document's id. Defaults to "langchain_id".
   * @param {string} metadataJsonColumn Optional - Column to store metadata as JSON. Defaults to "langchain_metadata".
   * @param {DistanceStrategy} distanceStrategy Distance strategy to use for vector similarity search. Defaults to COSINE_DISTANCE.
   * @param {Number} k Number of Documents to return from search. Defaults to 4.
   * @param {Number} fetch_k Number of Documents to fetch to pass to MMR algorithm.
   * @param {Number} lambdaMult Number between 0 and 1 that determines the degree of diversity among the results with 0 corresponding to maximum diversity and 1 to minimum diversity. Defaults to 0.5.
   * @param {QueryOptions} indexQueryOptions Optional - Index query option.
   * @returns PostgresVectorStore instance.
   */
  static async create(
    engine: PostgresEngine,
    embeddings: Embeddings,
    tableName: string,
    {
      schemaName = "public",
      contentColumn = "content",
      embeddingColumn = "embedding",
      metadataColumns = [],
      ignoreMetadataColumns,
      idColumn = "langchain_id",
      metadataJsonColumn = "langchain_metadata",
      distanceStrategy = DEFAULT_DISTANCE_STRATEGY,
      k = 4,
      fetch_k = 20,
      lambdaMult = 0.5,
      indexQueryOptions
    }: PostgresVectorStoreArgs
  ): Promise<PostgresVectorStore> {

    if(metadataColumns !== undefined && ignoreMetadataColumns !== undefined) {
      throw "Can not use both metadata_columns and ignore_metadata_columns.";
    }

    const {rows} = await engine.pool.raw(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = '${schemaName}'`);
    let columns: {[key: string]: any} = {};

    for (const index in rows) {
      const row = rows[index];
      columns[row["column_name"]] = row["data_type"]
    }

    if(!columns.hasOwnProperty(idColumn)){
      throw `Id column: ${idColumn}, does not exist.`;
    }

    if(!columns.hasOwnProperty(contentColumn)){
      throw `Content column: ${contentColumn}, does not exist.`;
    }

    const contentType = columns[contentColumn];

    if(contentType !== "text" && !contentType.includes("char")) {
      throw `Content column: ${contentColumn}, is type: ${contentType}. It must be a type of character string.`
    }

    if(!columns.hasOwnProperty(embeddingColumn)) {
      throw `Embedding column: ${embeddingColumn}, does not exist.`
    }
        
    if(columns[embeddingColumn] !== "USER-DEFINED") {
      throw `Embedding column: ${embeddingColumn} is not of type Vector.`
    }

    metadataJsonColumn = columns.hasOwnProperty(metadataJsonColumn) ? metadataJsonColumn : "";

    for (const column of metadataColumns) {
      if(!columns.hasOwnProperty(column)) {
        throw `Metadata column: ${column}, does not exist.`
      }
    }

    const allColumns = columns;
    if(ignoreMetadataColumns !== undefined && ignoreMetadataColumns.length > 0) {
      for (const column of ignoreMetadataColumns) {
        delete allColumns[column];
      }

      delete allColumns[idColumn];
      delete allColumns[contentColumn];
      delete allColumns[embeddingColumn];
      metadataColumns = Object.keys(allColumns);
    } 
    return new PostgresVectorStore(
      embeddings,
      {
        engine,
        tableName,
        schemaName,
        contentColumn,
        embeddingColumn,
        metadataColumns,
        ignoreMetadataColumns,
        idColumn,
        metadataJsonColumn,
        distanceStrategy,
        k,
        fetch_k,
        lambdaMult,
        indexQueryOptions
      }
    )
  }

  _vectorstoreType(): string {
    return "cloudsqlpostgresql"
  }
  addVectors(vectors: number[][], documents: DocumentInterface[], options?: { [x: string]: any; }): Promise<string[] | void> {
    throw new Error("Method not implemented.");
  }
  addDocuments(documents: DocumentInterface[], options?: { [x: string]: any; }): Promise<string[] | void> {
    throw new Error("Method not implemented.");
  }
  similaritySearchVectorWithScore(query: number[], k: number, filter?: this["FilterType"] | undefined): Promise<[DocumentInterface, number][]> {
    throw new Error("Method not implemented.");
  }

  /**
   * Deletes documents from the vector store based on the specified parameters.
   *
   * @param _params - Flexible key-value pairs defining conditions for document deletion.
   * @returns A promise that resolves once the deletion is complete.
   */
  async delete(_params?: Record<string, any>): Promise<void> { // TODO: test this method
    if(_params === undefined) return;
    const idList = _params.map((id: any) => `'${id}'`).join(", ");
    const query = `DELETE FROM "${this.schemaName}"."${this.tableName}" WHERE ${this.idColumn} in (${idList})`;
    await this.engine.pool.raw(query);
  }
}

export default PostgresVectorStore;
