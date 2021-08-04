type ConfigType = {
  authorizerURL: string;
  redirectURL?: string;
};

type User = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  image?: string | null;
};

type TokenType = {
  accessToken: string;
  accessTokenExpiresAt: number;
  user?: User;
};

enum OAuthProviders {
  Github = 'github',
  Google = 'google',
}

const hasWindow = () => typeof window !== 'undefined';

const graphqlQuery = async (endpoint: string, query: string) => {
  const res = await fetch(endpoint, {
    method: 'POST',
    body: JSON.stringify({
      query,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  const json = await res.json();
  if (json.errors && json.errors.length) {
    throw new Error(json.errors[0].message);
  }

  return json.data;
};

class Authorizer {
  // class variable
  config: ConfigType;
  graphQLEndPoint: string;

  // constructor
  constructor(config: ConfigType) {
    if (!config) {
      throw new Error(`Configuration is required`);
    }
    this.config = config;
    if (!config.authorizerURL.trim()) {
      throw new Error(`Invalid authorizerURL`);
    }
    if (config.authorizerURL) {
      const trimmedData = config.authorizerURL.trim();
      const lastChar = trimmedData[trimmedData.length - 1];
      if (lastChar === '/') {
        this.config.authorizerURL = trimmedData.slice(0, -1);
      } else {
        this.config.authorizerURL = trimmedData;
      }
    }
    if (!config.redirectURL && hasWindow) {
      this.config.redirectURL = window.location.origin.toString();
    }

    this.graphQLEndPoint = `${this.config.authorizerURL}/graphql`;
  }

  getMetaData = async () => {
    try {
      const res = await graphqlQuery(
        this.graphQLEndPoint,
        `
      query {
        meta {
          version
          isGoogleLoginEnabled
          isGithubLoginEnabled
          isBasicAuthenticationEnabled
          isEmailVerificationEnabled
          isFacebookLoginEnabled
          isTwitterLoginEnabled
        }
      }
    `
      );

      return res.meta;
    } catch (err) {
      throw err;
    }
  };

  getSession = async (): Promise<TokenType> => {
    try {
      const res = await graphqlQuery(
        this.graphQLEndPoint,
        `
      query {
        token {
          accessToken
          accessTokenExpiresAt
          user {
            id
            email
            firstName
            lastName
            image
          }
        }
      }
    `
      );
      return res.token;
    } catch (err) {
      throw err;
    }
  };

  logout = async (): Promise<void> => {
    try {
      await graphqlQuery(
        this.graphQLEndPoint,
        `
        mutation {
          logout {
            message
          }
        }
    `
      );
    } catch (err) {
      console.error(err);
    }
  };

  fingertipLogin = async (): Promise<TokenType | void> => {
    try {
      const token = await this.getSession();
      return token;
    } catch (err) {
      if (!hasWindow()) {
        throw new Error(`browserLogin is only supported for browsers`);
      }
      window.location.href = `${this.config.authorizerURL}/app?state=${btoa(
        JSON.stringify(this.config)
      )}`;
    }
  };

  oauthLogin = async (oauthProvider: string): Promise<TokenType | void> => {
    try {
      const token = await this.getSession();
      return token;
    } catch (err) {
      // @ts-ignore
      if (!Object.values(OAuthProviders).includes(oauthProvider)) {
        throw new Error(
          `only following oauth providers are supported: ${Object.values(
            oauthProvider
          ).toString()}`
        );
      }
      if (!hasWindow()) {
        throw new Error(`oauthLogin is only supported for browsers`);
      }
      window.location.href = `${this.config.authorizerURL}/oauth_login/${oauthProvider}`;
    }
  };
}
