import { Embeddings, EmbeddingsInterface } from "@langchain/core/embeddings";
import { VectorStore } from "@langchain/core/vectorstores";
import { DocumentInterface, Document } from "@langchain/core/documents";
import { v4 as uuidv4 } from "uuid";
import { DEFAULT_DISTANCE_STRATEGY, DistanceStrategy, QueryOptions } from "./indexes.js";
import PostgresEngine from "./engine.js";
import { customZip } from "./utils/utils.js";

type Metadata = Record<string, unknown>;

export interface PostgresVectorStoreArgs {
  schemaName?: string,
  contentColumn?: string,
  embeddingColumn?: string,
  metadataColumns?: Array<string>,
  idColumn?: string,
  distanceStrategy?: DistanceStrategy,
  k?: Number,
  fetchK?: Number,
  lambdaMult?: Number,
  ignoreMetadataColumns?: Array<string>,
  metadataJsonColumn?: string,
  indexQueryOptions?: QueryOptions
}

class PostgresVectorStore extends VectorStore {
  declare FilterType: Metadata;

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
  fetchK: Number;
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
    this.engine = dbConfig.engine;
    this.tableName = dbConfig.tableName;
    this.schemaName = dbConfig.schemaName;
    this.contentColumn = dbConfig.contentColumn;
    this.embeddingColumn = dbConfig.embeddingColumn;
    this.metadataColumns = dbConfig.metadataColumns;
    this.ignoreMetadataColumns = dbConfig.ignoreMetadataColumns;
    this.idColumn = dbConfig.idColumn;
    this.metadataJsonColumn = dbConfig.metadataJsonColumn;
    this.distanceStrategy = dbConfig.distance_strategy;
    this.k = dbConfig.k;
    this.fetchK = dbConfig.fetchK;
    this.lambdaMult = dbConfig.lambdaMult;
    this.indexQueryOptions = dbConfig.indexQueryOptions;
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
   * @param {Number} fetchK Number of Documents to fetch to pass to MMR algorithm.
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
      fetchK = 20,
      lambdaMult = 0.5,
      indexQueryOptions
    }: PostgresVectorStoreArgs
  ): Promise<PostgresVectorStore> {

    if (metadataColumns !== undefined && ignoreMetadataColumns !== undefined) {
      throw "Can not use both metadata_columns and ignore_metadata_columns.";
    }

    const { rows } = await engine.pool.raw(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = '${schemaName}'`);
    let columns: { [key: string]: any } = {};

    for (const index in rows) {
      const row = rows[index];
      columns[row["column_name"]] = row["data_type"]
    }

    if (!columns.hasOwnProperty(idColumn)) {
      throw `Id column: ${idColumn}, does not exist.`;
    }

    if (!columns.hasOwnProperty(contentColumn)) {
      throw `Content column: ${contentColumn}, does not exist.`;
    }

    const contentType = columns[contentColumn];

    if (contentType !== "text" && !contentType.includes("char")) {
      throw `Content column: ${contentColumn}, is type: ${contentType}. It must be a type of character string.`
    }

    if (!columns.hasOwnProperty(embeddingColumn)) {
      throw `Embedding column: ${embeddingColumn}, does not exist.`
    }

    if (columns[embeddingColumn] !== "USER-DEFINED") {
      throw `Embedding column: ${embeddingColumn} is not of type Vector.`
    }

    metadataJsonColumn = columns.hasOwnProperty(metadataJsonColumn) ? metadataJsonColumn : "";

    for (const column of metadataColumns) {
      if (!columns.hasOwnProperty(column)) {
        throw `Metadata column: ${column}, does not exist.`
      }
    }

    const allColumns = columns;
    if (ignoreMetadataColumns !== undefined && ignoreMetadataColumns.length > 0) {
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
        fetchK,
        lambdaMult,
        indexQueryOptions
      }
    )
  }

  async addVectors(vectors: number[][], documents: Document[], options?: { ids?: string[] }): Promise<string[] | void> {
    let ids: string[] = [];
    let metadatas: Record<string, any>[] = []

    if (vectors.length !== documents.length) {
      throw new Error("The number of vectors must match the number of documents provided.");
    } else if (options && options.ids && options.ids.length !== documents.length ) {
      throw new Error("The number of ids must match the number of documents provided.");
    }

    if (options && options.ids) {
      ids = options.ids;
    } else {
      documents.forEach(document => {
        if(document.id !== undefined) {
          ids.push(document.id);
        } else {
          ids.push(uuidv4());
        }
      });
    }

    documents.forEach(document => {
      metadatas.push(document.metadata)
    });

    const tuples = customZip(ids, documents, vectors, metadatas);

    // Insert embeddings
    for (const [id, document, embedding, metadata] of tuples) {
      const metadataColNames = this.metadataColumns.length > 0 ? `"${this.metadataColumns.join("\",\"")}"` : "";

      let stmt = `INSERT INTO "${this.schemaName}"."${this.tableName}"("${this.idColumn}", "${this.contentColumn}", "${this.embeddingColumn}", ${metadataColNames}`
      let values: { [key: string]: any } = {
        id: id,
        content: document.pageContent,
        embedding: `[${embedding.toString()}]`
      }
      let valuesStmt = " VALUES (:id, :content, :embedding";

      // Add metadata
      let extra = metadata;
      for (const metadataColumn of this.metadataColumns) {
        if (metadata.hasOwnProperty(metadataColumn)) {
          valuesStmt += `, :${metadataColumn}`;
          values[metadataColumn] = metadata[metadataColumn]
          delete extra[metadataColumn]
        } else {
          valuesStmt += " ,null"
        }
      }

      // Add JSON column and/or close statement
      stmt += this.metadataJsonColumn ? `, ${this.metadataJsonColumn})` : ")";
      if (this.metadataJsonColumn) {
        valuesStmt += ", :extra)";
        Object.assign(values, { "extra": JSON.stringify(extra) })
      } else {
        valuesStmt += ")"
      }

      const query = stmt + valuesStmt;
      await this.engine.pool.raw(query, values)
    }

    return options?.ids;
  }

  _vectorstoreType(): string {
    return "cloudsqlpostgresql"
  }

  /**
   * Adds documents to the vector store, embedding them first through the
   * `embeddings` instance.
   *
   * @param documents - Array of documents to embed and add.
   * @param options - Optional configuration for embedding and storing documents.
   * @returns A promise resolving to an array of document IDs or void, based on implementation.
   * @abstract
   */
  async addDocuments(documents: Document[], options?: { ids?: string[] }): Promise<string[] | void> {
    let texts = [];

    for (const doc of documents) {
      texts.push(doc.pageContent)
    }

    const embeddings = await this.embeddings.embedDocuments(texts);
    const results = await this.addVectors(embeddings, documents, options);

    return results;
  }

  similaritySearchVectorWithScore(query: number[], k: number, filter?: this["FilterType"] | undefined): Promise<[DocumentInterface, number][]> {
    throw new Error("Method not implemented.");
  }

  /**
   * Deletes documents from the vector store based on the specified ids.
   *
   * @param params - Flexible key-value pairs defining conditions for document deletion.
   * @param ids -  Optional: Property of {params} that contains the array of ids to be deleted
   * @returns A promise that resolves once the deletion is complete.
   */
  async delete(params: { ids?: string[] }): Promise<void> { // TODO: test this method
    if (params.ids === undefined) return;
    const idList = params.ids.map((id: any) => `'${id}'`).join(", ");
    const query = `DELETE FROM "${this.schemaName}"."${this.tableName}" WHERE ${this.idColumn} in (${idList})`;
    await this.engine.pool.raw(query);
  }
}

export default PostgresVectorStore;
