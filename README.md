# Authorizer.js

[`@authorizerdev/authorizer-js`](https://www.npmjs.com/package/@authorizerdev/authorizer-js) is the universal JavaScript/TypeScript SDK for the Authorizer API. Current version: **3.2.1**.

It supports:

- [UMD (Universal Module Definition)](https://github.com/umdjs/umd) build for browsers
- [CommonJS (cjs)](https://flaviocopes.com/commonjs/) build for Node.js environments that do not support ES Modules
- [ESM (ES Modules)](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/) build for modern JavaScript

## Migration Guide

### 2.x -> 3.x

`3.x` introduces a `Protocol` type (`'graphql' | 'rest'`) and an optional `protocol` field on the constructor. The response shape is unchanged from 2.x — all methods return `{ data: T | undefined, errors: Error[] }`.

The config type is now exported as `ConfigType`.

### 1.x -> 2.x

`2.x` introduced the uniform `{ data, errors }` response shape. In `1.x` methods returned data directly and threw on error.

---

## Constructor

```ts
import { Authorizer } from '@authorizerdev/authorizer-js';

const authRef = new Authorizer({
  authorizerURL: 'https://your-instance.example.com',
  redirectURL: window.location.origin,
  clientID: 'YOUR_CLIENT_ID',
  // optional — 'graphql' (default) or 'rest'
  protocol: 'graphql',
});
```

| Key             | Required | Description                                               |
| --------------- | -------- | --------------------------------------------------------- |
| `authorizerURL` | Yes      | Base URL of your Authorizer instance                      |
| `redirectURL`   | Yes      | URL to redirect to after a successful login               |
| `clientID`      | Yes      | Client ID from the Authorizer dashboard                   |
| `protocol`      | No       | Transport protocol: `'graphql'` (default) or `'rest'`     |

The `protocol` option controls which transport the SDK uses. `'graphql'` sends requests to the `/graphql` endpoint; `'rest'` uses the REST API (`/api/*`). Both expose the same feature set.

---

## Install

### npm / yarn

```sh
npm i --save @authorizerdev/authorizer-js
# or
yarn add @authorizerdev/authorizer-js
```

### CDN (IIFE / UMD)

```html
<script src="https://unpkg.com/@authorizerdev/authorizer-js@3.2.1/lib/authorizer.min.js"></script>
```

---

## CommonJS

```js
const { Authorizer } = require('@authorizerdev/authorizer-js');

const authRef = new Authorizer({
  authorizerURL: 'https://your-instance.example.com',
  redirectURL: 'https://your-app.example.com',
  clientID: 'YOUR_CLIENT_ID',
});

async function main() {
  const { data, errors } = await authRef.login({
    email: 'user@example.com',
    password: 'Abc@123',
  });
  if (errors.length) console.error(errors);
  else console.log(data.access_token);
}
```

## ES Modules

```js
import { Authorizer } from '@authorizerdev/authorizer-js';

const authRef = new Authorizer({
  authorizerURL: 'https://your-instance.example.com',
  redirectURL: 'https://your-app.example.com',
  clientID: 'YOUR_CLIENT_ID',
});

async function main() {
  const { data, errors } = await authRef.login({
    email: 'user@example.com',
    password: 'Abc@123',
  });
}
```

## IIFE (Browser)

```html
<script src="https://unpkg.com/@authorizerdev/authorizer-js@3.2.1/lib/authorizer.min.js"></script>
<script type="text/javascript">
  const authorizerRef = new authorizerdev.Authorizer({
    authorizerURL: 'AUTHORIZER_URL',
    redirectURL: window.location.origin,
    clientID: 'YOUR_CLIENT_ID',
  });

  async function onLoad() {
    const { data, errors } = await authorizerRef.authorize({
      response_type: 'code',
      use_refresh_token: false,
    });
    if (data && data.access_token) {
      const { data: user } = await authorizerRef.getProfile({
        Authorization: `Bearer ${data.access_token}`,
      });
      console.log(user.email);
    }
  }
  onLoad();
</script>
```

---

## Fine-grained authorization (FGA)

Authorizer ships an embedded [OpenFGA](https://openfga.dev) engine for relationship-based access control (ReBAC). You model your domain as object **types** with **relations** (`viewer`, `editor`, `owner`…), grant access by writing **relationship tuples** (`user:alice` is `viewer` of `document:1`), and ask the engine whether access is allowed.

Authoring the model and tuples is an admin task — do it once in the dashboard under **Authorization**, or via the `_fga_*` admin GraphQL API. The SDK exposes only the read-side checks an application needs at request time. For every call the subject defaults to the authenticated caller and is pinned server-side from the request (session cookie by default; pass the authorization header in Node.js). The optional `user` field (`"type:id"`, or a bare id treated as `"user:<id>"`) lets you check on behalf of someone else, but the server honors it only for super-admin callers or when it equals the caller's own token subject.

**Check permissions** — answers "does the subject have `relation` on `object`?" for one or more pairs in a single round trip.

```js
const { data } = await authRef.checkPermissions(
  { checks: [{ relation: 'can_view', object: 'document:1' }] },
  { Authorization: `Bearer ${token}` }, // omit in the browser to use the cookie
);

if (data?.results?.[0]?.allowed) {
  // caller may view document:1
}
```

Batch several checks at once:

```js
const { data } = await authRef.checkPermissions({
  checks: [
    { relation: 'can_view', object: 'document:1' },
    { relation: 'can_edit', object: 'document:1' },
  ],
});
// data?.results =>
//   [
//     { relation: 'can_view', object: 'document:1', allowed: true },
//     { relation: 'can_edit', object: 'document:1', allowed: false },
//   ]
```

**List accessible objects** — returns the ids of every object of a type the subject relates to.

```js
const { data } = await authRef.listPermissions({
  relation: 'can_view',
  object_type: 'document',
});
// data?.objects => ['document:1', 'document:7', ...]
```

---

## Local Development

### Prerequisites

- [pnpm](https://pnpm.io/installation)
- [Node.js](https://nodejs.org/en/download/)

### Setup

```sh
git clone https://github.com/authorizerdev/authorizer-js
cd authorizer-js
pnpm install
pnpm build
pnpm test
```

---

## Release

1. Bump the version in `package.json`.
2. Tag the commit: `git tag v<version>`
3. Push with tags: `git push origin main --tags`

The GitHub Actions release workflow handles npm publish and GitHub Release creation automatically.
