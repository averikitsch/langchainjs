import { test } from "@jest/globals";
import  { PostgresLoader, PostgresLoaderOptions } from "../d.js";
import PostgresEngine, { PostgresEngineArgs } from "../engine.js";
import { Document, DocumentInterface } from "@langchain/core/documents";

import * as dotenv from "dotenv";

dotenv.config()

const SCHEMA_NAME = "public";
const CUSTOM_TABLE = "test_table_custom";
const ID_COLUMN = "uuid";
const CONTENT_COLUMN = ["my_content"];
const METADATA_COLUMNS = ["page", "source"];


const metadatas = [];
const docs: DocumentInterface[] = [];

const pgArgs: PostgresEngineArgs = {
  user: process.env.DB_USER ?? "",
  password: process.env.PASSWORD ?? ""
}

const documentLoaderArgs: PostgresLoaderOptions = {
  tableName: CUSTOM_TABLE,
  schemaName: SCHEMA_NAME,
  contentColumns: CONTENT_COLUMN,
  metadataColumns: METADATA_COLUMNS,
  format: "text",
  query: ""
};


describe("Document loader creation", () => {
  let PEInstance: PostgresEngine;
  let PostgresLoaderInstance: PostgresLoader;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.from_instance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );

  
  });

  test('should create a new document Loader instance', async () => {
    const documentLoaderArgs:  PostgresLoaderOptions= {
      tableName: CUSTOM_TABLE,
      schemaName: "public",
      contentColumns: ["my_content"],
      metadataColumns: ["page", "source"],
    }




    const vectorStoreInstance = await PostgresLoader.create(PEInstance, documentLoaderArgs)

    expect(vectorStoreInstance).toBeDefined();
  });

  afterAll(async () => {

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
  
})


