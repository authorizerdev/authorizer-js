// Static-analysis guard: the `Meta`/`AuthResponse` TypeScript interfaces and
// their hard-coded GraphQL selection strings in src/index.ts are two
// independent, unconnected pieces of code - adding a field to one without
// the other type-checks fine (tsc has no idea a string literal is supposed
// to mirror an interface). That's bitten this repo twice in one session
// (should_offer_webauthn_mfa_verify on AuthResponse, then is_mfa_enforced on
// Meta). This test reads the raw source of both files and asserts the field
// sets match, so a future drift fails a fast unit test instead of shipping
// silently.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const typesSource = readFileSync(
  join(__dirname, '../src/types.ts'),
  'utf-8',
);
const indexSource = readFileSync(join(__dirname, '../src/index.ts'), 'utf-8');

function interfaceFields(source: string, interfaceName: string): string[] {
  const match = source.match(
    new RegExp(`export interface ${interfaceName} \\{([\\s\\S]*?)\\n\\}`),
  );
  if (!match) throw new Error(`interface ${interfaceName} not found`);
  const fields: string[] = [];
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) continue;
    const fieldMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\??:/);
    if (fieldMatch) fields.push(fieldMatch[1]);
  }
  return fields;
}

// Parses a GraphQL selection-set snippet (no surrounding braces) into its
// top-level field names, skipping over nested object selections (`user {
// ... }`) and template interpolations (`${userFragment}`) rather than
// descending into them.
function topLevelSelectionFields(selection: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let i = 0;
  while (i < selection.length) {
    if (selection.startsWith('${', i)) {
      const end = selection.indexOf('}', i + 2);
      i = end === -1 ? selection.length : end + 1;
      continue;
    }
    const ch = selection[i];
    if (ch === '{') {
      depth++;
      i++;
      continue;
    }
    if (ch === '}') {
      depth--;
      i++;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i;
      while (j < selection.length && /[a-zA-Z0-9_]/.test(selection[j])) j++;
      if (depth === 0) fields.push(selection.slice(i, j));
      i = j;
      continue;
    }
    i++;
  }
  return fields;
}

describe('Meta interface stays in sync with the meta query', () => {
  it('every Meta field is selected, and every selected field is on Meta', () => {
    const interfaceFieldSet = new Set(interfaceFields(typesSource, 'Meta'));

    const queryMatch = indexSource.match(
      /query meta\s*\{\s*meta\s*\{([^}]*)\}\s*\}/,
    );
    if (!queryMatch) throw new Error('meta query not found in src/index.ts');
    const queryFieldSet = new Set(topLevelSelectionFields(queryMatch[1]));

    const missingFromQuery = [...interfaceFieldSet].filter(
      (f) => !queryFieldSet.has(f),
    );
    const missingFromInterface = [...queryFieldSet].filter(
      (f) => !interfaceFieldSet.has(f),
    );

    expect({ missingFromQuery, missingFromInterface }).toEqual({
      missingFromQuery: [],
      missingFromInterface: [],
    });
  });
});

describe('AuthResponse interface stays in sync with authTokenFragment', () => {
  it('every AuthResponse field is selected, and every selected field is on AuthResponse', () => {
    const interfaceFieldSet = new Set(
      interfaceFields(typesSource, 'AuthResponse'),
    );

    const fragmentMatch = indexSource.match(
      /const authTokenFragment = `([^`]*)`;/,
    );
    if (!fragmentMatch) throw new Error('authTokenFragment not found');
    const fragmentFieldSet = new Set(
      topLevelSelectionFields(fragmentMatch[1]),
    );

    const missingFromFragment = [...interfaceFieldSet].filter(
      (f) => !fragmentFieldSet.has(f),
    );
    const missingFromInterface = [...fragmentFieldSet].filter(
      (f) => !interfaceFieldSet.has(f),
    );

    expect({ missingFromFragment, missingFromInterface }).toEqual({
      missingFromFragment: [],
      missingFromInterface: [],
    });
  });
});
