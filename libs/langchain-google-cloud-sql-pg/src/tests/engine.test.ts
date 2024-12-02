import { describe, expect, test } from "@jest/globals";
import PostgresEngine from "../engine.js";
import { IpAddressTypes } from "@google-cloud/cloud-sql-connector";

import * as dotenv from "dotenv";

dotenv.config()

describe("PostgresEngine Instance creation", () => {
  let PEInstance: PostgresEngine;

  test('should throw an error if only user or password are passed', async () => {
    async function createInstance() {
      PEInstance = await PostgresEngine.from_instance(
        process.env.PROJECT_ID ?? "",
        process.env.REGION ?? "",
        process.env.INSTANCE_NAME ?? "",
        process.env.DB_NAME ?? "",
        IpAddressTypes.PUBLIC,
        process.env.DB_USER ?? ""
      );
    }
    await expect(createInstance).rejects.toBe(
      "Only one of 'user' or 'password' were specified. Either " +
      "both should be specified to use basic user/password " +
      "authentication or neither for IAM DB authentication."
    );
  });
  

  test('should create a PostgressEngine Instance using user and password', async () => {
    PEInstance = await PostgresEngine.from_instance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      IpAddressTypes.PUBLIC,
      process.env.DB_USER ?? "",
      process.env.PASSWORD ?? ""
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

  test('should create a PostgressEngine Instance with IAM email', async () => {
    PEInstance = await PostgresEngine.from_instance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      IpAddressTypes.PUBLIC, 
      "",
      "",
      process.env.EMAIL ?? "",
    );
    const {rows} = await PEInstance.testConnection();
    const currentTimestamp = rows[0].currenttimestamp;
    expect(currentTimestamp).toBeDefined();

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  }) 
})