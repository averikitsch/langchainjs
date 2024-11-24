import { describe, expect, test } from "@jest/globals";
import PostgresEngine from "../engine.js";
import { IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import * as dotenv from "dotenv";

dotenv.config({path: 'langchain-core/.env'})

describe("PostgresEngine Instance creation", () => {
  let PEInstance: PostgresEngine;
  console.log(process.env.PROJECT_ID)
  beforeAll(async () => {
    PEInstance = await PostgresEngine.create(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      IpAddressTypes.PUBLIC,
      process.env.USER,
      process.env.PASSWORD
    );
  });

  test('should create a PostgressEngine Instance with a db connection', async () => {
    const {rows} = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();
  })

  afterAll(async () => {
    try {
      await PEInstance.closeConnection();
    } catch (error) {
      console.log(`Error on closing connection: ${error}`);
    }
  });
})