import { test } from "@jest/globals";
import  { PostgresLoader, PostgresLoaderOptions } from "../DocumentLoader.js";
import PostgresEngine, { PostgresEngineArgs } from "../engine.js";

import * as dotenv from "dotenv";

dotenv.config()

const SCHEMA_NAME = "public";
const CUSTOM_TABLE = "test_table_custom";
const CONTENT_COLUMN = ["fruit_id","fruit_name","variety","quantity_in_stock","price_per_unit","organic"];
const METADATA_COLUMNS = ["variety"];
const FORMATTER = (row: { [key: string]: any }, content_columns: string[]): string => {
  return content_columns
    .filter((column) => column in row)
    .map((column) => String(row[column]))
    .join(" ");
};

const pgArgs: PostgresEngineArgs = {
  user: process.env.DB_USER ?? "",
  password: process.env.PASSWORD ?? ""
}

describe("Document loader creation", () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromInstance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS "${CUSTOM_TABLE}"`)


    await PEInstance.pool.raw(`CREATE TABLE IF NOT EXISTS "${CUSTOM_TABLE}" (
      fruit_id SERIAL PRIMARY KEY,
      fruit_name VARCHAR(100) NOT NULL,
      variety VARCHAR(50),
      quantity_in_stock INT NOT NULL,
      price_per_unit INT NOT NULL,
      organic INT NOT NULL
    );`)
  
      await PEInstance.pool.raw(` INSERT INTO "${CUSTOM_TABLE}" (
        fruit_name, variety, quantity_in_stock, price_per_unit, organic
    ) VALUES ('Apple', 'Granny Smith', 150, 1, 1); `)


  });

  test('should throw an error if no table name or query is provided', async () => {
    const documentLoaderArgs:  PostgresLoaderOptions= {
      schemaName: undefined,
      query: undefined,
    }

    async function createInstance() {
      await PostgresLoader.create(PEInstance, documentLoaderArgs)
    }

    expect(createInstance()).rejects.toThrowError("At least one of the parameters 'table_name' or 'query' needs to be provided");
  });


  test('should throw an error if an invalid format is provided', async () => {
      const documentLoaderArgs: any = {
        tableName: CUSTOM_TABLE,
        format: 'invalid_format',
      };

      async function createInstance() {
        await PostgresLoader.create(PEInstance, documentLoaderArgs);
      }

      await expect(createInstance()).rejects.toThrowError("format must be type: 'csv', 'text', 'json', 'yaml'");
    });

   test('should throw an error if both format and formatter are provided', async () => {
      const documentLoaderArgs: PostgresLoaderOptions = {
        tableName: CUSTOM_TABLE,
        format: "text",
        formatter: FORMATTER,
      };

      async function createInstance() {
        await PostgresLoader.create(PEInstance, documentLoaderArgs);
      }

      await expect(createInstance()).rejects.toThrowError("Only one of 'format' or 'formatter' should be specified.");
    });

    test('should throw an error if both table name and query are provided', async () => {
      const documentLoaderArgs: PostgresLoaderOptions = {
        tableName: CUSTOM_TABLE,
        schemaName: SCHEMA_NAME,
        query: "SELECT * FROM some_table",
      };

      async function createInstance() {
        await PostgresLoader.create(PEInstance, documentLoaderArgs);
      }

      await expect(createInstance()).rejects.toThrowError("Only one of 'table_name' or 'query' should be specified.");
    });
    
    test('should throw an error if content columns or metadata columns not match with column names', async () => {
      const documentLoaderArgs: PostgresLoaderOptions = {
        tableName: CUSTOM_TABLE,
        schemaName: SCHEMA_NAME,
        contentColumns: ["Imnotacolunm"]
      };

      async function createInstance() {
        await PostgresLoader.create(PEInstance, documentLoaderArgs);
      }

      await expect(createInstance()).rejects.toThrowError(`Column Imnotacolunm not found in query result fruit_id,fruit_name,variety,quantity_in_stock,price_per_unit,organic.`);

    });

  test('should create a new document Loader instance', async () => {
    const documentLoaderArgs:  PostgresLoaderOptions= {
      tableName: CUSTOM_TABLE,
      schemaName: "public",
      contentColumns: CONTENT_COLUMN,
      metadataColumns: METADATA_COLUMNS,
      format: "text",
      query: "",
      formatter: undefined,
    }

    const documentLoaderInstace = await PostgresLoader.create(PEInstance, documentLoaderArgs)

    expect(documentLoaderInstace).toBeDefined();
  });

  afterAll(async () => {

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
  
})

describe("Document loader methods", () => { 
  
  let PEInstance: PostgresEngine;
  let postgresLoaderInstance: PostgresLoader;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.fromInstance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );

    const documentLoaderArgs: PostgresLoaderOptions = {
      tableName: CUSTOM_TABLE,
      schemaName: SCHEMA_NAME,
      contentColumns: CONTENT_COLUMN,
      metadataColumns: METADATA_COLUMNS,
      format: "text",
      query: "",
      formatter: undefined,
    }



    await PEInstance.pool.raw(`DROP TABLE IF EXISTS "${CUSTOM_TABLE}"`)

    
    await PEInstance.pool.raw(`CREATE TABLE IF NOT EXISTS "${CUSTOM_TABLE}" (
      fruit_id SERIAL PRIMARY KEY,
      fruit_name VARCHAR(100) NOT NULL,
      variety VARCHAR(50),
      quantity_in_stock INT NOT NULL,
      price_per_unit INT NOT NULL,
      organic INT NOT NULL
    );`)
  
      await PEInstance.pool.raw(` INSERT INTO "${CUSTOM_TABLE}" (
        fruit_name, variety, quantity_in_stock, price_per_unit, organic
    ) VALUES ('Apple', 'Granny Smith', 150, 1, 1); `)


    postgresLoaderInstance = await PostgresLoader.create(PEInstance, documentLoaderArgs)


})
 
test('should load documents correctly', async () => {
  const documents = await postgresLoaderInstance.load();
  expect(documents).toBeDefined();
  expect(documents.length).toBeGreaterThan(0);
  expect(documents[0]).toHaveProperty('pageContent');
  expect(documents[0]).toHaveProperty('metadata');
});


afterAll(async () => {
  try {
    await PEInstance.closeConnection();
  } catch (error) {
    throw new Error(`Error on closing connection: ${error}`);
  }
})

})
