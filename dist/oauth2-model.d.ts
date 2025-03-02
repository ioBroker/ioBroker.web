import { type Client, type Falsey, type RefreshTokenModel, type Token, type PartialToken, type User, type RefreshToken, type Scope } from 'oauth2-server';
import type { NextFunction, Request, Response } from 'express';
export declare class OAuth2Model implements RefreshTokenModel {
    private readonly accessTokenLifetime;
    private readonly refreshTokenLifetime;
    private adapter;
    private readonly secure;
    /**
     * Create a OAuth2model
     *
     * @param adapter ioBroker adapter
     * @param options Options
     * @param options.accessLifetime Access token expiration in seconds
     * @param options.refreshLifeTime Refresh token expiration in seconds
     * @param options.secure Secured connection
     */
    constructor(adapter: ioBroker.Adapter, options?: {
        accessLifetime?: number;
        refreshLifeTime?: number;
        secure?: boolean;
    });
    getAccessToken: (bearerToken: string) => Promise<Token | Falsey>;
    /**
     * Get client.
     */
    getClient: (_clientId: string, _clientSecret: string) => Promise<Client | Falsey>;
    authorize: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /**
     * Get refresh token.
     */
    getRefreshToken: (bearerToken: string) => Promise<RefreshToken | Falsey>;
    /**
     * Get user.
     */
    getUser: (username: string, password: string) => Promise<User | Falsey>;
    /**
     * Save token.
     */
    saveToken: (token: PartialToken, client: Client, user: User) => Promise<Token | Falsey>;
    revokeToken: (token: RefreshToken | Token) => Promise<boolean>;
    verifyScope: (_token: Token, _scope: Scope) => Promise<boolean>;
}
