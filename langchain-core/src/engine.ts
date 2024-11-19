/* 
The constructor receives:

Args:
  key (object): Prevent direct constructor usage.
  pool (AsyncEngine): Async engine connection pool.
  loop (Optional[asyncio.AbstractEventLoop]): Async event loop used to create the engine.
  thread (Optional[Thread]): Thread used to create the engine async.
  
  Raises:
    Exception: If the constructor is called directly by the user. 
*/

// The create method, creates the DB connection and returns an PostgresEngine instance

import { CredentialBody, GoogleAuth } from 'google-auth-library';
import { ADCResponse, JSONClient, } from 'google-auth-library/build/src/auth/googleauth';
import { Connector, IpAddressTypes } from "@google-cloud/cloud-sql-connector";
import Knex from "knex";

/**
 * Get email address associated with current authenticated IAM principal.
 * Email will be used for automatic IAM database authentication to Cloud SQL.
 * 
 * @param {GoogleAuth} credentials - object to use in finding the associated IAM principal email address.
 * @returns {string} email - email address associated with the current authenticated IAM principal
 */
const getIAMPrincipalEmail = async (auth: GoogleAuth<JSONClient>): Promise<string> => {
  // TODO: Implement this function
  // Python validation: 
  // if(!auth.credential.credentials.access_token) { // How can I validate that the object has an token and if not how can I refresh it
  //   const newCredentials = 
  //   auth.credential.setCredentials(newCredentials)
  // }
  const credentials = await auth.getCredentials();
  if('client_email' in credentials && credentials.client_email !== undefined) {
    return credentials.client_email.replace(".gserviceaccount.com", "");
  }

  const accessToken = await auth.getAccessToken();
  const url = `https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}}`;
  const clientResponse = await auth.request({url}).then(res => res.data)
  
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
  pool: Promise<Knex.Knex<any, unknown[]>>;

  constructor(key: Symbol, pool: Promise<Knex.Knex<any, unknown[]>>) {
    if(key !== PostgresEngine._createKey) {
      throw new Error("Only create class through 'create' method!")
    }
    this.pool = pool;
  }

  static async create(
      projectId: string,
      region: string,
      instanceName: string,
      dbName: string,
      ipType: IpAddressTypes,
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
        const auth = await new GoogleAuth({
          scopes: "https://www.googleapis.com/auth/userinfo.email"
        })
        // dbUser should be the iam principal email by passing the credentials obtained
        dbUser = await getIAMPrincipalEmail(auth)
      }
    }

    const getConnection = async () => {
      const connector = new Connector()
      const clientOpts = await connector.getOptions({
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
        }
      };
      return Knex(dbConfig)
    }

    const engine = getConnection()

    return new PostgresEngine(PostgresEngine._createKey, engine)

    // Then use the SQLAlchemy to create the postgress engine
  }
}