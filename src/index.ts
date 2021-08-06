// this file used for browser build and exposing Authorizer as global object

import Authorizer from './lib';

// @ts-ignore
window.Authorizer = Authorizer;
