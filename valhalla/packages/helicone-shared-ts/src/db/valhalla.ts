import { Pool, PoolClient, QueryResult } from "pg";
import { getEnvironment } from "../environment/get";
import { PromiseGenericResult, Result, err, ok } from "../modules/result";
import {
  ValhallaFeedback,
  ValhallaRequest,
  ValhallaResponse,
} from "./valhalla.database.types";

export interface IValhallaDB {
  query(query: string, values: any[]): PromiseGenericResult<QueryResult<any>>;
  now(): PromiseGenericResult<QueryResult<any>>;
  insertRequest(
    request: ValhallaRequest
  ): PromiseGenericResult<QueryResult<any>>;
  insertResponse(
    response: ValhallaResponse
  ): PromiseGenericResult<QueryResult<any>>;
  updateResponse(
    response: ValhallaResponse
  ): PromiseGenericResult<QueryResult<any>>;
  upsertFeedback(
    feedback: ValhallaFeedback
  ): PromiseGenericResult<QueryResult<any>>;
  close(): Promise<void>;
}

async function timeoutPromise<T>(
  ms: number,
  promise: Promise<T>,
  errString?: string
): Promise<Result<T, string>> {
  try {
    let timeout = new Promise((resolve, reject) => {
      let id = setTimeout(() => {
        clearTimeout(id);
        resolve(err(errString ?? "rejected"));
      }, ms);
    });
    return (await Promise.race([
      promise.then((e) => ok(e)),
      timeout,
    ])) as Promise<Result<T, string>>;
  } catch (e) {
    return err(`Promise was rejected: ${JSON.stringify(e)}, ${errString}`);
  }
}

class ValhallaDB implements IValhallaDB {
  pool: Pool;

  constructor(auroraCreds: string) {
    const auroraHost = process.env.AURORA_HOST;
    const auroraPort = process.env.AURORA_PORT;
    const auroraDb = process.env.AURORA_DATABASE;

    if (!auroraCreds) {
      throw new Error("No creds");
    }

    if (!auroraHost) {
      throw new Error("No host");
    }

    if (!auroraPort) {
      throw new Error("No port");
    }

    if (!auroraDb) {
      throw new Error("No database");
    }

    const {
      username,
      password,
    }: {
      username: string;
      password: string;
    } = JSON.parse(auroraCreds);

    this.pool = new Pool({
      host: auroraHost,
      port: parseInt(auroraPort),
      user: username,
      password: password,
      database: auroraDb,
      log: (msg) => {
        console.log(msg);
      },
      max: 20, // we can probably increase this
      idleTimeoutMillis: 5_000, // close idle clients after 5 second
      connectionTimeoutMillis: 10_000,
      maxUses: 10_000,
      ssl:
        getEnvironment() === "development"
          ? undefined
          : {
              rejectUnauthorized: true, // This should be set to true for better security
            },
    });
  }

  async close() {
    await this.pool.end();
  }

  private async withConnection<T>(
    fn: (client: PoolClient) => PromiseGenericResult<T>
  ): PromiseGenericResult<T> {
    const { data: client, error: clientError } = await timeoutPromise(
      10_000,
      this.pool.connect(),
      "Pool failed to connect"
    );
    if (clientError || !client) {
      return err(clientError);
    }
    try {
      return await fn(client);
    } catch (e) {
      return err(`Error in withConnection: ${e}`);
    } finally {
      client.release();
    }
  }

  private async _query(
    query: string,
    values: any[] = []
  ): PromiseGenericResult<QueryResult<any>> {
    return await this.withConnection(async (client) => {
      return await timeoutPromise(
        5_000,
        client.query(query, values).then(async (res) => {
          return res;
        }),
        "Query timed out"
      );
    });
  }
  async query(
    query: string,
    values: any[] = []
  ): PromiseGenericResult<QueryResult<any>> {
    const { data: queryResult, error: queryResultError } = await timeoutPromise(
      30_000,
      this._query(query, values).then(async (res) => {
        return res;
      }),
      "this._query timed out"
    );
    if (queryResultError || !queryResult) {
      console.error("Error in query", query, queryResultError);
      return err(queryResultError);
    }
    return queryResult;
  }

  async now() {
    return this.query("SELECT NOW() as now");
  }

  async upsertFeedback(
    feedback: ValhallaFeedback
  ): PromiseGenericResult<QueryResult<any>> {
    const query = `
      INSERT INTO feedback (
        response_id,
        rating,
        created_at
      )
      VALUES (
        $1, $2, $3
      )
      ON CONFLICT (response_id) DO UPDATE SET
        rating = EXCLUDED.rating,
        created_at = EXCLUDED.created_at;
    `;
    return this.query(query, [
      feedback.responseID,
      feedback.rating,
      feedback.createdAt.toISOString(),
    ]);
  }

  async updateResponse(
    response: ValhallaResponse
  ): PromiseGenericResult<QueryResult<any>> {
    const query = `
      UPDATE response
      SET
        body = $1,
        delay_ms = $2,
        http_status = $3,
        completion_tokens = $4,
        model = $5,
        prompt_tokens = $6,
        response_received_at = $7
      WHERE id = $8
    `;
    return this.query(query, [
      JSON.stringify(response.body),
      response.delayMs,
      response.http_status,
      response.completionTokens,
      response.model,
      response.promptTokens,
      response.responseReceivedAt?.toISOString(),
      response.id,
    ]);
  }

  async insertRequest(
    request: ValhallaRequest
  ): PromiseGenericResult<QueryResult<any>> {
    const query = `
      INSERT INTO request (
        id,
        created_at,
        url_href,
        user_id,
        properties,
        helicone_org_id,
        provider,
        body,
        request_received_at,
        model
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      );
    `;
    console.log("Inserting request", request.id);
    return this.query(query, [
      request.id,
      request.createdAt.toISOString(),
      request.urlHref,
      request.userId,
      JSON.stringify(request.properties),
      request.heliconeOrgID,
      request.provider,
      JSON.stringify(request.body),
      request.requestReceivedAt.toISOString(),
      request.model,
    ]);
  }

  async insertResponse(
    response: ValhallaResponse
  ): PromiseGenericResult<QueryResult<any>> {
    const query = `
    INSERT INTO response (
      id,
      created_at,
      body,
      request,
      delay_ms,
      http_status,
      completion_tokens,
      model,
      prompt_tokens,
      response_received_at,
      helicone_org_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `;
    return this.query(query, [
      response.id,
      response.createdAt.toISOString(),
      JSON.stringify(response.body),
      response.request,
      response.delayMs,
      response.http_status,
      response.completionTokens,
      response.model,
      response.promptTokens,
      response.responseReceivedAt?.toISOString(),
      response.heliconeOrgID,
    ]);
  }
}

class StaticValhallaPool {
  private static client: ValhallaDB | null = null;

  static async getClient(): Promise<IValhallaDB> {
    if (this.client === null) {
      const auroraCreds = process.env.AURORA_CREDS;
      if (!auroraCreds) {
        // TODO get from secrets manager?
        throw new Error("No creds found in secret");
      } else {
        this.client = new ValhallaDB(auroraCreds);
      }
    }
    return this.client;
  }
}

export async function createValhallaClient(): Promise<IValhallaDB> {
  return StaticValhallaPool.getClient();
}
