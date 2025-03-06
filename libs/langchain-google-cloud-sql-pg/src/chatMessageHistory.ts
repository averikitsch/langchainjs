import { BaseChatMessageHistory } from "@langchain/core/chat_history";
import { BaseMessage } from "@langchain/core/messages";
import PostgresEngine from "./engine.js";

export interface PostgresChatMessageHistoryInput {
  engine: PostgresEngine;
  sessionId: string;
  tableName: string;
  schemaName: string;
}

export class PostgresChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace: string[] = ["langchain", "stores", "message", "google-cloud-sql-pg"];

  engine: PostgresEngine;
  
  sessionId: string;
  
  tableName: string;
  
  schemaName: string;

  constructor({engine, sessionId, tableName, schemaName = "public"} : PostgresChatMessageHistoryInput) {
    super();
    this.engine = engine;
    this.sessionId = sessionId;
    this.tableName = tableName;
    this.schemaName = schemaName;
  }

  /**
   * Create a new PostgresChatMessageHistory instance.
   *
   * @param {PostgresEngine} engine Postgres engine instance to use.
   * @param {string} sessionId Retrieve the table content witht this session ID.
   * @param {string} tableName Table name that stores that chat message history.
   * @param {string} schemaName Schema name for the chat message history table. Default: "public".
   * @returns PostgresChatMessageHistory instance.
   */
  static async create(
    engine: PostgresEngine,
    sessionId: string,
    tableName: string,
    schemaName: string = "public"
  ) {
    const query = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${tableName}' AND table_schema = '${schemaName}'`;
    const { rows } = await engine.pool.raw(query);
    const columnNames: string[] = [];

    for (const index in rows) {
      if (Object.prototype.hasOwnProperty.call(rows, index)) {
        columnNames.push(rows[index].column_name);
      }
    }

    const requiredColumns = ["id", "session_id", "data", "type"];

    if (!requiredColumns.every((x) => columnNames.includes(x))) {
      throw new Error(
        `Table '${schemaName}'.'${tableName}' has incorrect schema.
        Got column names ${columnNames} but required column names ${requiredColumns}.\n
        Please create table with following schema: \nCREATE TABLE '${schemaName}'.'${tableName}' (
        \n    id SERIAL AUTO_INCREMENT PRIMARY KEY,
        \n    session_id TEXT NOT NULL,
        \n    data JSONB NOT NULL,
        \n    type TEXT NOT NULL
        \n);
      `);
    }

    return new PostgresChatMessageHistory({engine, sessionId, tableName, schemaName})
  }

  addUserMessage(message: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  addAIChatMessage(message: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getMessages(): Promise<BaseMessage[]> {
    throw new Error("Method not implemented.");
  }

  addMessage(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  clear(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
