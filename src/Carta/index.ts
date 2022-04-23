/*
|--------------------------------------------------------------------------
| Ally Oauth driver
|--------------------------------------------------------------------------
|
| This is a dummy implementation of the Oauth driver. Make sure you
|
| - Got through every line of code
| - Read every comment
|
*/

import type { AllyUserContract } from '@ioc:Adonis/Addons/Ally'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import { Oauth2Driver, ApiRequest, RedirectRequest } from '@adonisjs/ally/build/standalone'

/**
 * Define the access token object properties in this type. It
 * must have "token" and "type" and you are free to add
 * more properties.
 *
 * ------------------------------------------------
 * Change "CartaDriver" to something more relevant
 * ------------------------------------------------
 */
export type CartaDriverAccessToken = {
  token: string
  type: 'bearer'
}

/**
 * Define a union of scopes your driver accepts. Here's an example of same
 * https://github.com/adonisjs/ally/blob/develop/adonis-typings/ally.ts#L236-L268
 *
 * ------------------------------------------------
 * Change "CartaDriver" to something more relevant
 * ------------------------------------------------
 */
export type CartaDriverScopes = string

/**
 * Define the configuration options accepted by your driver. It must have the following
 * properties and you are free add more.
 *
 * ------------------------------------------------
 * Change "CartaDriver" to something more relevant
 * ------------------------------------------------
 */
export type CartaDriverConfig = {
  driver: 'carta'
  clientId: string
  clientSecret: string
  callbackUrl: string
  authorizeUrl?: string
  accessTokenUrl?: string
  userInfoUrl?: string
}

/**
 * Driver implementation. It is mostly configuration driven except the user calls
 *
 * ------------------------------------------------
 * Change "CartaDriver" to something more relevant
 * ------------------------------------------------
 */
export class CartaDriver extends Oauth2Driver<CartaDriverAccessToken, CartaDriverScopes> {
  /**
   * The URL for the redirect request. The user will be redirected on this page
   * to authorize the request.
   *
   * Do not define query strings in this URL.
   */
  protected authorizeUrl = 'https://auth.carta.id/authorize'

  /**
   * The URL to hit to exchange the authorization code for the access token
   *
   * Do not define query strings in this URL.
   */
  protected accessTokenUrl = 'https://api.auth.carta.id/auth/exchangeToken'

  /**
   * The URL to hit to get the user details
   *
   * Do not define query strings in this URL.
   */
  protected userInfoUrl = 'https://api.auth.carta.id/auth/me'

  /**
   * The param name for the authorization code. Read the documentation of your oauth
   * provider and update the param name to match the query string field name in
   * which the oauth provider sends the authorization_code post redirect.
   */
  protected codeParamName = 'authorizationCode'

  /**
   * The param name for the error. Read the documentation of your oauth provider and update
   * the param name to match the query string field name in which the oauth provider sends
   * the error post redirect
   */
  protected errorParamName = 'error'

  /**
   * Cookie name for storing the CSRF token. Make sure it is always unique. So a better
   * approach is to prefix the oauth provider name to `oauth_state` value. For example:
   * For example: "facebook_oauth_state"
   */
  protected stateCookieName = 'carta_oauth_state'

  /**
   * Parameter name to be used for sending and receiving the state from.
   * Read the documentation of your oauth provider and update the param
   * name to match the query string used by the provider for exchanging
   * the state.
   */
  protected stateParamName = 'challenge'

  /**
   * Parameter name for sending the scopes to the oauth provider.
   */
  protected scopeParamName = 'scope'

  /**
   * The separator indentifier for defining multiple scopes
   */
  protected scopesSeparator = ' '

  constructor(ctx: HttpContextContract, public config: CartaDriverConfig) {
    super(ctx, config)

    /**
     * Extremely important to call the following method to clear the
     * state set by the redirect request.
     *
     * DO NOT REMOVE THE FOLLOWING LINE
     */
    this.loadState()
  }

  /**
   * Optionally configure the authorization redirect request. The actual request
   * is made by the base implementation of "Oauth2" driver and this is a
   * hook to pre-configure the request.
   */
  protected configureRedirectRequest(request: RedirectRequest<CartaDriverScopes>) {
    const clientId = request.params['client_id']
    const redirectUri = request.params['redirect_uri']
    request.clearParam('client_id')
    request.clearParam('redirect_uri')
    request.param('client_code', clientId)
    request.param('redirect_url', redirectUri)
  }

  /**
   * Optionally configure the access token request. The actual request is made by
   * the base implementation of "Oauth2" driver and this is a hook to pre-configure
   * the request
   */
  protected configureAccessTokenRequest(request: ApiRequest) {
    request.field('challengeVerifier', this.stateCookieValue)
    request.field('clientSecret', this.options.clientSecret)
  }

  /**
   * get code from query params instead
   */
  public getCode(): string | null {
    return this.ctx.request.qs().authorization_code
  }

  /**
   * parse exchange token response
   */
  protected processClientResponse(client: ApiRequest, response: any) {
    const parsedResponse = super.processClientResponse(client, response)
    return {
      access_token: parsedResponse.data.accessToken,
      refresh_token: parsedResponse.data.refreshToken,
    }
  }

  public stateMisMatch(): boolean {
    return false
  }

  /**
   * Update the implementation to tell if the error received during redirect
   * means "ACCESS DENIED".
   */
  public accessDenied() {
    return this.ctx.request.input('error') === 'user_denied'
  }

  /**
   * Get the user details by query the provider API. This method must return
   * the access token and the user details both. Checkout the google
   * implementation for same.
   *
   * https://github.com/adonisjs/ally/blob/develop/src/Drivers/Google/index.ts#L191-L199
   */
  public async user(
    callback?: (request: ApiRequest) => void
  ): Promise<AllyUserContract<CartaDriverAccessToken>> {
    const accessToken = await this.accessToken()
    const request = this.httpClient(this.config.userInfoUrl || this.userInfoUrl)
    request.header('Authorization', `Bearer ${accessToken.token}`)

    /**
     * Allow end user to configure the request. This should be called after your custom
     * configuration, so that the user can override them (if required)
     */
    if (typeof callback === 'function') {
      callback(request)
    }

    /**
     * Write your implementation details here
     */
    const responseRaw = await request.get()
    const response = JSON.parse(responseRaw)
    const data = response.data || {}
    return {
      id: data.id,
      nickName: data.username,
      name: data.username,
      email: data.email,
      emailVerificationState: 'unsupported',
      avatarUrl: null,
      token: accessToken,
      original: response,
    }
  }

  public async userFromToken(
    accessToken: string,
    callback?: (request: ApiRequest) => void
  ): Promise<AllyUserContract<{ token: string; type: 'bearer' }>> {
    const request = this.httpClient(this.config.userInfoUrl || this.userInfoUrl)

    /**
     * Allow end user to configure the request. This should be called after your custom
     * configuration, so that the user can override them (if required)
     */
    if (typeof callback === 'function') {
      callback(request)
    }

    /**
     * Write your implementation details here
     */
    const body = await request.get()
    return {
      id: body.id,
      nickName: body.username,
      name: body.username,
      email: body.email,
      emailVerificationState: 'unsupported',
      avatarUrl: null,
      token: {
        token: accessToken,
        type: 'bearer',
      },
      original: body,
    }
  }
}
