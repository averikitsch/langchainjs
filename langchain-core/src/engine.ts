import { Connector, IpAddressTypes} from "@google-cloud/cloud-sql-connector";
import { GoogleAuth } from "google-auth-library";
import Knex from "knex";

/**
 * Get email address associated with current authenticated IAM principal.
 * Email will be used for automatic IAM database authentication to Cloud SQL.
 * 
 * @param {GoogleAuth} auth - object to use in finding the associated IAM principal email address.
 * @returns {string} email - email address associated with the current authenticated IAM principal
 */
const getIAMPrincipalEmail = async (auth: GoogleAuth): Promise<string> => {
  const credentials = await auth.getCredentials();
  if('client_email' in credentials && credentials.client_email !== undefined) {
    return credentials.client_email.replace(".gserviceaccount.com", "");
  }

  const accessToken = await auth.getAccessToken();
  const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}}`;
  const clientResponse = await auth.request({url}).then((res: { data: any; }) => res.data)
  
  if(!('email' in clientResponse)) {
    throw new Error(
      "Failed to automatically obtain authenticated IAM principal's " +
      "email address using environment's ADC credentials!"
    )
  }
  const email = clientResponse['email']
  return email.replace(".gserviceaccount.com", "");
}

class PostgresEngine {

  static _createKey = Symbol();
  private pool: Knex.Knex<any, any[]>;
  static connector: Connector;

  constructor(key: Symbol, pool: Knex.Knex<any, any[]>) {
    if(key !== PostgresEngine._createKey) {
      throw new Error("Only create class through 'create' method!")
    }
    this.pool = pool;
  }

  /**
   * 
   * @param projectId GCP Project ID
   * @param region Postgres Instance Region
   * @param instanceName Postgres Instance name
   * @param dbName Database name
   * @param ipType IP address type. Defaults to IPAddressType.Public
   * @param user Optional - Postgres user name. Defaults to undefined
   * @param password Optional - Postgres user password. Defaults to undefined
   * @param iamAccountEmail Optional - IAM service account email. Defaults to undefined
   * @returns PostgressEngine instance
   */

  static async create(
      projectId: string,
      region: string,
      instanceName: string,
      dbName: string,
      ipType: IpAddressTypes = IpAddressTypes.PUBLIC,
      user?: string, 
      password?: string,
      iamAccountEmail?: string,
    ) {

    let dbUser: string;

    if((!user && password) || (user && !password)) { // Trying to implement an XOR for strings
      throw new Error(
        "Only one of 'user' or 'password' were specified. Either " +
        "both should be specified to use basic user/password " +
        "authentication or neither for IAM DB authentication."
      )
    }

    if(user !== "" && password !== "") { // user and password are given so we use the basic auth
      dbUser = user!;
    } else {
      if(iamAccountEmail !== undefined) {
        dbUser = iamAccountEmail
      } else {
        // Get application default credentials
        const auth = new GoogleAuth({
          scopes: "https://www.googleapis.com/auth/userinfo.email"
        })
        // dbUser should be the iam principal email by passing the credentials obtained
        dbUser = await getIAMPrincipalEmail(auth)
      }
    }

    const getConnection = async (): Promise<Knex.Knex> => {
      PostgresEngine.connector = new Connector();
      const clientOpts = await PostgresEngine.connector.getOptions({
        instanceConnectionName: `${projectId}:${region}:${instanceName}`,
        ipType: ipType
      })
      const dbConfig = {
        client: 'pg',
        connection: {
          ...clientOpts,
          user: dbUser,
          password: password, 
          database: dbName,
        },
        pool: {
          min: 2,
          max: 10, // How many connections should be the max connections,
          acquireTimeoutMillis: 30000
        }
      };
      return Knex(dbConfig)
    }

    const engine = await getConnection()
      .then( response => response)
      .catch(error => {
        throw new Error(`Error while trying to establish connection ${error}`)
      });

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