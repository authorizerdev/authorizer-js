// Regression guard: every field on AuthResponse/Meta must have a matching
// token in its corresponding hand-written GraphQL query/fragment string in
// src/index.ts, and vice versa. TypeScript type-checking does NOT catch this
// class of bug — the interface and the query string are independent, and
// this project has shipped the omission twice (should_offer_webauthn_mfa_verify
// and is_mfa_enforced both missing from their query strings, in an earlier,
// unmerged version of this same MFA work).
import * as fs from 'fs';
import * as path from 'path';

const indexSource = fs.readFileSync(
  path.join(__dirname, '../src/index.ts'),
  'utf-8',
);
const typesSource = fs.readFileSync(
  path.join(__dirname, '../src/types.ts'),
  'utf-8',
);

function fieldsOfInterface(source: string, interfaceName: string): string[] {
  const match = source.match(
    new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) throw new Error(`interface ${interfaceName} not found`);
  const body = match[1];
  const fieldRegex = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\??:/gm;
  const fields: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = fieldRegex.exec(body))) {
    fields.push(m[1]);
  }
  return fields;
}

describe('query/type sync', () => {
  it('every AuthResponse field appears in authTokenFragment, and vice versa', () => {
    const fields = fieldsOfInterface(typesSource, 'AuthResponse').filter(
      (f) => f !== 'user', // nested fragment, not a flat token
    );
    const fragmentMatch = indexSource.match(
      /const authTokenFragment = `([\s\S]*?)`;/,
    );
    expect(fragmentMatch).not.toBeNull();
    const fragment = fragmentMatch![1];

    // Extract only top-level tokens, excluding nested content inside user { ... }
    const userStart = fragment.indexOf('user {');
    const topLevelFragment = userStart !== -1
      ? fragment.substring(0, userStart) + 'user'
      : fragment;
    const queryFields = topLevelFragment
      .split(/\s+/)
      .filter((f) => f && f !== 'user'); // exclude nested user fragment

    for (const field of fields) {
      expect(queryFields).toContain(field);
    }
    for (const queryField of queryFields) {
      expect(fields).toContain(queryField);
    }
  });

  it('every Meta field appears in the meta query string, and vice versa', () => {
    const fields = fieldsOfInterface(typesSource, 'Meta');
    const queryMatch = indexSource.match(/query meta \{ meta \{ ([\s\S]*?) \} \}/);
    expect(queryMatch).not.toBeNull();
    const queryFields = queryMatch![1].trim().split(/\s+/);

    for (const field of fields) {
      expect(queryFields).toContain(field);
    }
    for (const queryField of queryFields) {
      expect(fields).toContain(queryField);
    }
  });

  it('every User field appears in userFragment, and vice versa', () => {
    const fields = fieldsOfInterface(typesSource, 'User');
    const fragmentMatch = indexSource.match(
      /const userFragment =\s*'([\s\S]*?)';/,
    );
    expect(fragmentMatch).not.toBeNull();
    const fragmentFields = fragmentMatch![1].split(/\s+/).filter(f => f);

    for (const field of fields) {
      expect(fragmentFields).toContain(field);
    }
    for (const fragmentField of fragmentFields) {
      expect(fields).toContain(fragmentField);
    }
  });
});
