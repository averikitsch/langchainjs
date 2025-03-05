import {
  PostgresEngine,
  PostgresEngineArgs,
  PostgresVectorStore,
  PostgresVectorStoreArgs,
} from "@langchain/langchain-google-cloud-sql-pg";
import { SyntheticEmbeddings } from "@langchain/core/utils/testing";

const pgArgs: PostgresEngineArgs = {
  user: "db-user",
  password: "password",
};

const engine: PostgresEngine = await PostgresEngine.from_instance(
  "project-id",
  "region",
  "instance-name",
  "database-name",
  pgArgs
);

const pvectorArgs: PostgresVectorStoreArgs = {
    idColumn: "id-column",
    contentColumn: "my-content-column",
    embeddingColumn: "my-embedding-column",
    metadataColumns: ["page", "source"],
    metadataJsonColumn: "mymeta",
  };

await engine.init_vectorstore_table("my-table", 768);

const embeddingService = new SyntheticEmbeddings({ vectorSize: 768 });

const vectorStore = await PostgresVectorStore.create(
  engine,
  embeddingService,
  "my-table"
);
