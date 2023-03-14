import murmurhash from 'murmurhash';
import type { FetchOptions } from 'ofetch';
import { Headers, ofetch } from 'ofetch';

const HASH_MULTIPLIER = 2 ** 32 / 10_000;

/**
 * Options for configuring a PreprClient instance.
 * @public
 */
export interface PreprClientOptions {
  /**
   * The Prepr API token used to authenticate requests.
   */
  token: string;

  /**
   * The base URL of the Prepr API. If not provided, defaults to https://cdn.prepr.io.
   */
  baseUrl?: string | URL;

  /**
   * The timeout in milliseconds for requests to the Prepr API. If not provided, defaults to 4000.
   */
  timeout?: number;

  /**
   * The ID of the user associated with this PreprClient instance.
   */
  userId?: string;
}

class PreprClient {
  /**
   * The headers used for all requests made by this PreprClient instance.
   * @private
   */
  #headers = new Headers();

  /**
   * The base URL of the Prepr API used for all requests made by this PreprClient instance.
   * @default https://cdn.prepr.io
   * @private
   */
  #baseUrl = new URL('https://cdn.prepr.io');

  /**
   * The timeout in milliseconds for requests made by this PreprClient instance.
   * @default 4000
   * @private
   */
  #timeout = 4000;

  /**
   * The ID of the user associated with this PreprClient instance.
   * @private
   */
  #userId?: number;

  /**
   * The path used for the request.
   * @private
   */
  #path = '';

  /**
   * The GraphQL query used for the request.
   * @private
   */
  #graphqlQuery?: string;

  /**
   * The GraphQL variables used for the request.
   * @private
   */
  #graphqlVariables: object = {};

  /**
   * The query parameters used for the request.
   * @public
   */
  public query = new URLSearchParams();

  /**
   * Creates a new PreprClient instance with the specified options.
   * @param options - The options used to configure the PreprClient instance.
   */
  constructor(options: PreprClientOptions) {
    this.token(options.token);

    if (options.baseUrl) this.#baseUrl = new URL(options.baseUrl);

    if (typeof options.timeout === 'number') this.#timeout = options.timeout;

    if (options.userId) this.#userId = this.calculateUserId(options.userId);
  }

  /**
   * Calculates the numeric user ID from a string.
   * @private
   */
  private calculateUserId(userId: string): number {
    return murmurhash(userId, 1) * HASH_MULTIPLIER;
  }

  /**
   * Sets the user ID for the Prepr-ABTesting header used in requests made by this PreprClient instance.
   * @param userId - The user ID to set. If `undefined`, the header will be removed from requests.
   * @returns This PreprClient instance.
   */
  userId(userId?: string): this {
    this.#userId = typeof userId === 'string' ? this.calculateUserId(userId) : userId;

    return this;
  }

  /**
   * Sets the timeout for requests made by this PreprClient instance.
   * @param milliseconds - The timeout in milliseconds.
   * @returns This PreprClient instance.
   */
  timeout(milliseconds: number): this {
    this.#timeout = milliseconds;
    return this;
  }

  /**
   * Sets the timeout in milliseconds for requests made by this PreprClient instance.
   * @param milliseconds - The timeout in milliseconds.
   * @returns This PreprClient instance.
   */
  sort(field: string): this {
    this.query.set('sort', field);
    return this;
  }

  /**
   * Sets the maximum number of results to return for requests made by this PreprClient instance.
   * @param limit - The maximum number of results to return.
   * @returns This PreprClient instance.
   */
  limit(limit: number): this {
    this.query.set('limit', `${limit}`);
    return this;
  }

  /**
   * Sets the number of results to skip for requests made by this PreprClient instance.
   * @param skip - The number of results to skip.
   * @returns This PreprClient instance.
   */
  skip(skip: number): this {
    this.query.set('skip', `${skip}`);
    return this;
  }

  /**
   * Sets the path for requests made by this PreprClient instance.
   * @param path - The path to set.
   * @returns This PreprClient instance.
   */
  path(path: string): this {
    this.#path = path;
    return this;
  }

  /**
   * Sets the Prepr API token for requests made by this PreprClient instance.
   * @param token - The Prepr API token to set.
   * @returns This PreprClient instance.
   */
  token(token: string): this {
    this.#headers.set('Authorization', `Bearer ${token}`);
    return this;
  }

  /**
   * Sets the GraphQL query to include in requests made by this PreprClient instance.
   * @param graphqlQuery - The GraphQL query to set.
   * @returns This PreprClient instance.
   */
  graphqlQuery(graphqlQuery: string): this {
    this.#graphqlQuery = graphqlQuery;
    return this;
  }

  /**
   * Sets the GraphQL variables to include in requests made by this PreprClient instance.
   * @param graphqlVariables - The GraphQL variables to set.
   * @returns This PreprClient instance.
   */
  graphqlVariables(graphqlVariables: object): this {
    this.#graphqlVariables = graphqlVariables;
    return this;
  }

  /**
   * Makes a request to the Prepr API.
   * @param request - The request to make. This can be a URL, a Request object, or a string representing a path to append to the base URL.
   * @param options - The options for the request. These will be merged with the options set on this PreprClient instance.
   * @returns A Promise that resolves to the response from the Prepr API.
   */
  async fetch<TData>(
    request: RequestInfo = this.#path,
    options?: FetchOptions<'json'>,
  ): Promise<TData> {
    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), this.#timeout);

    if (this.#userId) this.#headers.set('Prepr-ABTesting', `${this.#userId}`);

    const gqlOptions = (
      this.#graphqlQuery
        ? {
            method: 'POST',
            body: {
              query: this.#graphqlQuery,
              variables: this.#graphqlVariables,
            },
          }
        : {}
    ) satisfies FetchOptions;

    const fetcher = ofetch.create({
      baseURL: this.#baseUrl.toString(),
      headers: this.#headers,
      query: this.query,
      signal: controller.signal,
      onResponse: () => {
        clearTimeout(fetchTimeout);

        this.query = new URLSearchParams();
        this.#graphqlQuery = '';
        this.#graphqlVariables = {};
      },
      ...gqlOptions,
    });

    return fetcher<TData>(request, options);
  }
}

/**
 * Creates a new instance of `PreprClient`.
 * @param options - The options used to configure the `PreprClient` instance.
 * @returns A new instance of `PreprClient`.
 * @public
 */
export const createPreprClient = (options: PreprClientOptions) => new PreprClient(options);
