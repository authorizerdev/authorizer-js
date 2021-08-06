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

const hasWindow = (): boolean => typeof window !== 'undefined';

export default class Authorizer {
  // class variable
  config: ConfigType;

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
    if (!config.redirectURL) {
      throw new Error(`Invalid redirectURL`);
    }
  }

  // helper to execute graphql queries
  // takes in any query or mutation string as input
  graphqlQuery = async (query: string) => {
    const res = await fetch(this.config.authorizerURL + '/graphql', {
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

  getMetaData = async () => {
    try {
      const res = await this.graphqlQuery(
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
      const res = await this.graphqlQuery(
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
      await this.graphqlQuery(
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
        throw new Error(`fingertipLogin is only supported for browsers`);
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
