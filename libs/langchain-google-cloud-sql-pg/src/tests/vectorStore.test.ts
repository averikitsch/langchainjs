import { test } from "@jest/globals";
import PostgresVectorStore, { PostgresVectorStoreArgs } from "../vectorStore.js";
import PostgresEngine, { Column, VectorStoreTableArgs } from "../engine.js";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";
import knex from "knex";
import * as dotenv from "dotenv";

dotenv.config()

const CUSTOM_TABLE = "test_table_custom";
const VECTOR_SIZE = 768;
const ID_COLUMN="uuid";
const CONTENT_COLUMN = "my_content";
const EMBEDDING_COLUMN = "my_embedding";
const METADATA_COLUMNS = [new Column("page", "TEXT"), new Column("source", "TEXT")];
const STORE_METADATA = true;

const embeddingService = new SyntheticEmbeddings({vectorSize: VECTOR_SIZE});

describe("VectorStore creation", () => {
  let PEInstance: PostgresEngine;
  let vectorStoreInstance: PostgresVectorStore;

  beforeAll(async () => {
    const url = `postgresql+asyncpg://${process.env.DB_USER}:${process.env.PASSWORD}@${process.env.HOST}:5432/${process.env.DB_NAME}`;
    const poolConfig: knex.Knex.PoolConfig = {
      min: 0,
      max: 5
    }

    PEInstance = await PostgresEngine.from_engine_args(url, poolConfig);

    const vsTableArgs: VectorStoreTableArgs = {
      contentColumn: CONTENT_COLUMN,
      embeddingColumn: EMBEDDING_COLUMN,
      idColumn: ID_COLUMN, 
      metadataColumns: METADATA_COLUMNS,
      storeMetadata: STORE_METADATA,
      overwriteExisting: true
    };

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS ${CUSTOM_TABLE}`)
    await PEInstance.init_vectorstore_table(CUSTOM_TABLE, VECTOR_SIZE, vsTableArgs);
  });
  
  test('should throw an error if metadataColumns and ignoreMetadataColumns are defined', async () => {
    const pvectorArgs: PostgresVectorStoreArgs = {
      metadataColumns: ["page", "source"],
      ignoreMetadataColumns: ["page", "source"]
    }

    async function createVectorStoreInstance() {
      vectorStoreInstance = await PostgresVectorStore.create(PEInstance, embeddingService, CUSTOM_TABLE, pvectorArgs)
    }

    await expect(createVectorStoreInstance).rejects.toBe("Can not use both metadata_columns and ignore_metadata_columns.");
  });

  test('should throw an error if idColumn does not exist', async () => {
    const pvectorArgs: PostgresVectorStoreArgs = {
      idColumn: "my_id_column",
      contentColumn: CONTENT_COLUMN,
      embeddingColumn: EMBEDDING_COLUMN,
      metadataColumns: ["page", "source"],
      metadataJsonColumn: "mymeta",
    }

    async function createVectorStoreInstance() {
      vectorStoreInstance = await PostgresVectorStore.create(PEInstance, embeddingService, CUSTOM_TABLE, pvectorArgs)
    }

    await expect(createVectorStoreInstance).rejects.toBe(`Id column: ${pvectorArgs.idColumn}, does not exist.`);
  });

  test('should throw an error if contentColumn does not exist', async () => {
    const pvectorArgs: PostgresVectorStoreArgs = {
      idColumn: ID_COLUMN,
      contentColumn: "content_column_test",
      embeddingColumn: EMBEDDING_COLUMN,
      metadataColumns: ["page", "source"],
      metadataJsonColumn: "mymeta",
    }

    async function createVectorStoreInstance() {
      vectorStoreInstance = await PostgresVectorStore.create(PEInstance, embeddingService, CUSTOM_TABLE, pvectorArgs)
    }

    await expect(createVectorStoreInstance).rejects.toBe(`Content column: ${pvectorArgs.contentColumn}, does not exist.`);
  });

  test('should throw an error if embeddingColumn does not exist', async () => {
    const pvectorArgs: PostgresVectorStoreArgs = {
      idColumn: ID_COLUMN,
      contentColumn: CONTENT_COLUMN,
      embeddingColumn: "embedding_column_test",
      metadataColumns: ["page", "source"],
      metadataJsonColumn: "mymeta",
    }

    async function createVectorStoreInstance() {
      vectorStoreInstance = await PostgresVectorStore.create(PEInstance, embeddingService, CUSTOM_TABLE, pvectorArgs)
    }

    await expect(createVectorStoreInstance).rejects.toBe(`Embedding column: ${pvectorArgs.embeddingColumn}, does not exist.`);
  });

  test('should create a new VectorStoreInstance', async () => {
    const pvectorArgs: PostgresVectorStoreArgs = {
      idColumn: ID_COLUMN,
      contentColumn: CONTENT_COLUMN,
      embeddingColumn: EMBEDDING_COLUMN,
      metadataColumns: ["page", "source"],
      metadataJsonColumn: "mymeta",
    }

    const vectorStoreInstance = await PostgresVectorStore.create(PEInstance, embeddingService, CUSTOM_TABLE, pvectorArgs)
    
    expect(vectorStoreInstance).toBeInstanceOf(PostgresVectorStore);
  });

  // TODO: Add a test for the delete method

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CUSTOM_TABLE}"`)

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
})
