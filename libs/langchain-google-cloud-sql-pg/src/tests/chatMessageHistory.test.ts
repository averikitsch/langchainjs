import { test } from "@jest/globals";
import * as dotenv from "dotenv";
import PostgresEngine, { PostgresEngineArgs } from "../engine.js";
import { PostgresChatMessageHistory } from "../chatMessageHistory.js";

dotenv.config()

const CHAT_MSG_TABLE = "test_message_table";

const pgArgs: PostgresEngineArgs = {
  user: process.env.DB_USER ?? "",
  password: process.env.PASSWORD ?? ""
}

describe("ChatMessageHistory creation", () => {
  let PEInstance: PostgresEngine;

  beforeAll(async () => {
    PEInstance = await PostgresEngine.from_instance(
      process.env.PROJECT_ID ?? "",
      process.env.REGION ?? "",
      process.env.INSTANCE_NAME ?? "",
      process.env.DB_NAME ?? "",
      pgArgs
    );

    await PEInstance.pool.raw(`DROP TABLE IF EXISTS ${CHAT_MSG_TABLE }`)
    
  });

  test("should throw an Error if the table has incorrect schema", async () => {
    await PEInstance.pool.raw(
      `CREATE TABLE IF NOT EXISTS public.${CHAT_MSG_TABLE}(
      my_id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      data JSONB NOT NULL,
      type TEXT NOT NULL);`
    )

    async function createChatMsgInstance() {
      const historyInstace = await PostgresChatMessageHistory.create(PEInstance, "test", CHAT_MSG_TABLE )
    }
    
    await expect(createChatMsgInstance).rejects.toThrowError(
      new Error(
        `Table 'public'.'${CHAT_MSG_TABLE}' has incorrect schema.
        Got column names my_id,session_id,data,type but required column names id,session_id,data,type.\n
        Please create table with following schema: \nCREATE TABLE 'public'.'${CHAT_MSG_TABLE}' (
        \n    id SERIAL AUTO_INCREMENT PRIMARY KEY,
        \n    session_id TEXT NOT NULL,
        \n    data JSONB NOT NULL,
        \n    type TEXT NOT NULL
        \n);
      `)
    );

    await PEInstance.pool.raw(`DROP TABLE ${CHAT_MSG_TABLE }`)
  })

  test("should create a new PostgresChatMessageHistory instance", async () => {
    await PEInstance.init_chat_history_table(CHAT_MSG_TABLE )

    const historyInstace = await PostgresChatMessageHistory.create(PEInstance, "test", CHAT_MSG_TABLE )
    
    expect(historyInstace).toBeDefined();
  })

  afterAll(async () => {
    await PEInstance.pool.raw(`DROP TABLE "${CHAT_MSG_TABLE }"`)

    try {
      await PEInstance.closeConnection();
    } catch (error) {
      throw new Error(`Error on closing connection: ${error}`);
    }
  })
});