import Authorizer from '../lib/index.mjs';

const authRef = new Authorizer({
  authorizerURL: 'https://authorizer-demo.herokuapp.com',
  redirectURL: 'https://authorizer-demo.herokuapp.com/app',
});

console.log({ config: authRef.config });
