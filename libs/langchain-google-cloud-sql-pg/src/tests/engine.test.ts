import { describe, expect, test } from "@jest/globals";
import PostgresEngine from "../engine.js";
import { AuthTypes, Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import { PostgresEngineArgs, Column, VectorStoreTableArgs } from "../engine.js";
import knex from "knex";
import * as dotenv from "dotenv";

dotenv.config()

const USER_AGENT = "langchain-google-cloud-sql-pg-js";
const CUSTOM_TABLE = "test_table_custom";
const CHAT_MSG_TABLE = "test_message_table";
const DOCUMENT_TABLE = "test_document_table";
const VECTOR_SIZE = 768;
const ID_COLUMN="uuid";
const CONTENT_COLUMN = "my_content";
const EMBEDDING_COLUMN = "my_embedding";
const METADATA_COLUMNS = [new Column("page", "TEXT"), new Column("source", "TEXT")];
const STORE_METADATA = true;

describe("PostgresEngine Instance creation", () => {
  let PEInstance: PostgresEngine;

  const poolConfig: knex.Knex.PoolConfig = {
    min: 0,
    max: 5
  }

  test('should throw an error if only user or password are passed', async () => {
    const pgArgs: PostgresEngineArgs = {
      user: process.env.DB_USER ?? ""
    }

    async function createInstance() {
      PEInstance = await PostgresEngine.fromInstance(
        process.env.PROJECT_ID ?? "",
        process.env.REGION ?? "",
        process.env.INSTANCE_NAME ?? "",
        process.env.DB_NAME ?? "",
        pgArgs
      );
    }

    await expect(createInstance).rejects.toBe(
      "Only one of 'user' or 'password' were specified. Either " +
      "both should be specified to use basic user/password " +
      "authentication or neither for IAM DB authentication."
    );
  });

  test('should create a PostgresEngine Instance using user and password', async () => {
    const pgArgs: PostgresEngineArgs = {
      user: process.env.DB_USER ?? "",
      password: process.env.PASSWORD ?? ""
    }

    PEInstance = await PostgresEngine.fromInstance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );

    const {rows} = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });

  test('should create a PostgresEngine Instance with IAM email', async () => {
    const pgArgs: PostgresEngineArgs = {
      ipType: IpAddressTypes.PUBLIC,
      iamAccountEmail: process.env.EMAIL ?? ""
    }

    PEInstance = await PostgresEngine.fromInstance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );
    
    const {rows} = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  }); 

  test('should create a PostgresEngine Instance through from_engine method', async () => {
    PostgresEngine.connector = new Connector({userAgent: USER_AGENT});
    const clientOpts = await PostgresEngine.connector.getOptions({
      instanceConnectionName: `${process.env.PROJECT_ID}:${process.env.REGION}:${process.env.INSTANCE_NAME}`,
      ipType: IpAddressTypes.PUBLIC,
      authType: AuthTypes.PASSWORD
    })

    const dbConfig: knex.Knex.Config<any> = {
      client: 'pg',
      connection: {
        ...clientOpts,
        password: process.env.PASSWORD,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
      },
    };

    const engine = knex(dbConfig)
    PEInstance = await PostgresEngine.fromEngine(engine)

    const {rows} = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });

  test('should throw an error if the URL passed to from_engine_args does not have the driver', async () => {
    const url = "";

    async function createInstance() {
      PEInstance = await PostgresEngine.fromEngineArgs(url);
    }

    await expect(createInstance).rejects.toBe("Driver must be type 'postgresql+asyncpg'");
  });

  test('should create a PostgresEngine Instance through from_engine_args using a URL', async () => {
    const url = `postgresql+asyncpg://${process.env.DB_USER}:${process.env.PASSWORD}@${process.env.HOST}:5432/${process.env.DB_NAME}`

    PEInstance = await PostgresEngine.fromEngineArgs(url, poolConfig);

    const {rows} = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  });
})

describe('PostgresEngine - table initialization', () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    const pgArgs: PostgresEngineArgs = {
      user: process.env.DB_USER ?? "",
      password: process.env.PASSWORD ?? ""
    }

    PEInstance = await PostgresEngine.fromInstance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );
  })
  
  test('should create the vectorstore table',async () => {
    const vsTableArgs: VectorStoreTableArgs = {
      contentColumn: CONTENT_COLUMN,
      embeddingColumn: EMBEDDING_COLUMN,
      idColumn: ID_COLUMN, 
      metadataColumns: METADATA_COLUMNS,
      storeMetadata: STORE_METADATA,
      overwriteExisting: true
    };

    await PEInstance.initVectorstoreTable(CUSTOM_TABLE, VECTOR_SIZE, vsTableArgs);

    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${CUSTOM_TABLE}';`
    const expected = [
      {'column_name': 'uuid', 'data_type': 'uuid'},
      {'column_name': 'my_embedding', 'data_type': 'USER-DEFINED'},
      {'column_name': 'langchain_metadata', 'data_type': 'json'},
      {'column_name': 'my_content', 'data_type': 'text'},
      {'column_name': 'page', 'data_type': 'text'},
      {'column_name': 'source', 'data_type': 'text'},
    ]

    const {rows} = await PEInstance.pool.raw(query);

    rows.forEach((row: any, index: number) => {
      expect(row).toMatchObject(expected[index])
    });
  })

  test('should create the chat history table',async () => {
    await PEInstance.initChatHistoryTable(CHAT_MSG_TABLE);

    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${CHAT_MSG_TABLE}';`
    const expected = [
      {'column_name': 'id', 'data_type': 'integer'},
      {'column_name': 'data', 'data_type': 'jsonb'},
      {'column_name': 'session_id', 'data_type': 'text'},
      {'column_name': 'type', 'data_type': 'text'},
    ]

    const {rows} = await PEInstance.pool.raw(query);

    rows.forEach((row: any, index: number) => {
      expect(row).toMatchObject(expected[index])
    });
  })

  test('should create the document table',async () => {
    await PEInstance.init_document_table(DOCUMENT_TABLE);

    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${DOCUMENT_TABLE}';`
    const expected = [
      {'column_name': 'id', 'data_type': 'integer'},
      {'column_name': 'metadata', 'data_type': 'jsonb'},
      {'column_name': 'content', 'data_type': 'text'},
      {'column_name': 'session_id', 'data_type': 'text'},
      {'column_name': 'type', 'data_type': 'text'},
    ]

    const {rows} = await PEInstance.pool.raw(query);

    rows.forEach((row: any, index: number) => {
      expect(row).toMatchObject(expected[index])
    });
  })

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CUSTOM_TABLE}"`)
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE}"`)
    await PEInstance.pool.raw(`DROP TABLE "${DOCUMENT_TABLE}"`)

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
})
