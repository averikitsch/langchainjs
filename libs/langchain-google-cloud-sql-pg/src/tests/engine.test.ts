import { describe, expect, test } from "@jest/globals";
import PostgresEngine from "../engine.js";
import { IpAddressTypes } from "@google-cloud/cloud-sql-connector";

import { PostgresEngineArgs } from "../engine.js";

import * as dotenv from "dotenv";

dotenv.config()

describe("PostgresEngine Instance creation", () => {
  let PEInstance: PostgresEngine;

  test('should throw an error if only user or password are passed', async () => {
    const pgArgs: PostgresEngineArgs = {
      projectId: process.env.PROJECT_ID ?? "",
      region: process.env.REGION ?? "",
      instance: process.env.INSTANCE_NAME ?? "",
      database: process.env.DB_NAME ?? "",
      ipType: IpAddressTypes.PUBLIC,
      user: process.env.DB_USER ?? ""
    }
    async function createInstance() {
      PEInstance = await PostgresEngine.from_instance(pgArgs);
    }
    await expect(createInstance).rejects.toBe(
      "Only one of 'user' or 'password' were specified. Either " +
      "both should be specified to use basic user/password " +
      "authentication or neither for IAM DB authentication."
    );
  });
  

  test('should create a PostgresEngine Instance using user and password', async () => {
    const pgArgs: PostgresEngineArgs = {
      projectId: process.env.PROJECT_ID ?? "",
      region: process.env.REGION ?? "",
      instance: process.env.INSTANCE_NAME ?? "",
      database: process.env.DB_NAME ?? "",
      ipType: IpAddressTypes.PUBLIC,
      user: process.env.DB_USER ?? "",
      password: process.env.PASSWORD ?? ""
    }
    PEInstance = await PostgresEngine.from_instance(pgArgs);
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
      projectId: process.env.PROJECT_ID ?? "",
      region: process.env.REGION ?? "",
      instance: process.env.INSTANCE_NAME ?? "",
      database: process.env.DB_NAME ?? "",
      ipType: IpAddressTypes.PUBLIC,
      iamAccountEmail: process.env.EMAIL ?? ""
    }
    PEInstance = await PostgresEngine.from_instance(pgArgs);
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