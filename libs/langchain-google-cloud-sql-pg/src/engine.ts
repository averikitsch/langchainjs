import { AuthTypes, Connector, IpAddressTypes} from "@google-cloud/cloud-sql-connector";
import { GoogleAuth } from "google-auth-library";
import knex from "knex";
import { getIAMPrincipalEmail } from "./utils/utils.js";

export interface PostgresEngineArgs {
  ipType?: IpAddressTypes,
  user?: string, 
  password?: string,
  iamAccountEmail?: string,
}

class PostgresEngine {

  private static _createKey = Symbol();
  pool: knex.Knex<any, any[]>;
  static connector: Connector;

  constructor(key: Symbol , pool: knex.Knex<any, any[]>) {
    if(key !== PostgresEngine._createKey) {
      throw new Error("Only create class through 'create' method!")
    }
    this.pool = pool;
  }

  /**
   * @param projectId Required - GCP Project ID
   * @param region Required - Postgres Instance Region
   * @param instance Required - Postgres Instance name
   * @param database Required - Database name
   * @param ipType Optional - IP address type. Defaults to IPAddressType.PUBLIC
   * @param user Optional - Postgres user name. Defaults to undefined
   * @param password Optional - Postgres user password. Defaults to undefined
   * @param iamAccountEmail Optional - IAM service account email. Defaults to undefined
   * @returns PostgresEngine instance
   */

  static async from_instance(
    projectId: string,
    region: string,
    instance: string,
    database: string,
    {
      ipType = IpAddressTypes.PUBLIC,
      user, 
      password,
      iamAccountEmail
    }: PostgresEngineArgs) {

    let dbUser: string;
    let enableIAMAuth: boolean;

    if((!user && password) || (user && !password)) { // Trying to implement an XOR for strings
      throw "Only one of 'user' or 'password' were specified. Either " +
        "both should be specified to use basic user/password " +
        "authentication or neither for IAM DB authentication.";
    }

    // User and password are given so we use the basic auth
    if(user !== undefined && password !== undefined) {
      enableIAMAuth = false;
      dbUser = user!;
    } else {
      enableIAMAuth = true;
      if(iamAccountEmail !== undefined) {
        dbUser = iamAccountEmail
      } else {
        // Get application default credentials
        const auth = new GoogleAuth({
          scopes: "https://www.googleapis.com/auth/cloud-platform"
        });
        // dbUser should be the iam principal email by passing the credentials obtained
        dbUser = await getIAMPrincipalEmail(auth)
      }
    }

    PostgresEngine.connector = new Connector();
    const clientOpts = await PostgresEngine.connector.getOptions({
      instanceConnectionName: `${projectId}:${region}:${instance}`,
      ipType: ipType,
      authType: enableIAMAuth ? AuthTypes.IAM : AuthTypes.PASSWORD
    })

    const dbConfig: knex.Knex.Config<any> = {
      client: 'pg',
      connection: {
        ...clientOpts,
        ...(password ? { password: password } : {}),
        user: dbUser,
        database: database,
      },
    };

    const engine = knex(dbConfig)
    
    return new PostgresEngine(PostgresEngine._createKey, engine)
  }

  /**
   *  Dispose of connection pool
   */
  async closeConnection(): Promise<void> {
    await this.pool.destroy()
    PostgresEngine.connector.close();
  }

  // Just to test the connection to the database
  testConnection () {
    const now = this.pool.raw('SELECT NOW() as currentTimestamp')
    return now;
  }
}

export default PostgresEngine;
