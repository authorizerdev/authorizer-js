// Note: write gql query in single line to reduce bundle size
import crossFetch from 'cross-fetch';
import * as Types from './types';
import { coerceInt64Fields, hasWindow, trimURL } from './utils';
import { toSDKError } from './errors';

// set fetch based on window object. Cross fetch have issues with umd build
const getFetcher = () => (hasWindow() ? window.fetch : crossFetch);

// re-usable gql response fragments shared across admin ops.
const userFragment =
  'id email email_verified given_name family_name middle_name nickname preferred_username picture signup_methods gender birthdate phone_number phone_number_verified roles created_at updated_at revoked_timestamp is_multi_factor_auth_enabled has_skipped_mfa_setup_at mfa_locked_at enrolled_mfa_methods app_data';
const paginationFragment = 'limit page offset total';
const webhookFragment =
  'id event_name event_description endpoint enabled headers created_at updated_at';
const webhookLogFragment =
  'id http_status response request webhook_id created_at updated_at';
const emailTemplateFragment =
  'id event_name template design subject created_at updated_at';
const auditLogFragment =
  'id actor_id actor_type actor_email action resource_type resource_id ip_address user_agent metadata created_at';
const clientFragment =
  'id name description allowed_scopes is_active created_at updated_at';
const trustedIssuerFragment =
  'id service_account_id name issuer_url key_source_type jwks_url expected_aud subject_claim allowed_subjects issuer_type is_active spiffe_refresh_hint_seconds created_at updated_at';
const organizationFragment =
  'id name display_name enabled created_at updated_at';
const orgMemberFragment = 'id org_id user_id roles created_at updated_at';
const orgOIDCConnectionFragment =
  'id org_id name issuer_url sso_client_id scopes redirect_uri is_active created_at updated_at';
const orgSAMLConnectionFragment =
  'id org_id name idp_entity_id idp_sso_url sp_entity_id acs_url attribute_mapping allow_idp_initiated is_active created_at updated_at';
const scimEndpointFragment = 'id org_id enabled created_at updated_at';
const orgDomainFragment = 'domain org_id verified_at created_at updated_at';

function toErrorList(errors: unknown): Types.AuthorizerSDKError[] {
  if (Array.isArray(errors)) {
    return errors.map(toSDKError);
  }
  if (errors instanceof Error) return [errors];
  if (errors !== null && typeof errors === 'object') {
    const o = errors as Record<string, unknown>;
    if (typeof o.message === 'string') return [new Error(o.message)];
    if (typeof o.error === 'string') return [new Error(o.error)];
  }
  if (errors === undefined || errors === null)
    return [new Error('Unknown error')];
  return [new Error(String(errors))];
}

// A graphql variant of an admin method: the op string, the named operation and
// the schema field whose value is the payload to unwrap.
interface GqlVariant {
  query: string;
  operationName: string;
  op: string;
}

// A rest variant of an admin method: the mapped admin endpoint plus the
// proto-gateway wrapper field to unwrap (omitted when the whole body is the
// payload).
interface RestVariant {
  method: 'GET' | 'POST';
  path: string;
  unwrap?: string;
}

/**
 * Admin client for the Authorizer super-admin API. Constructed with the admin
 * secret, which is sent on every call via `x-authorizer-admin-secret`; only use
 * this server-side and never expose the secret to a browser.
 *
 * `protocol` selects the wire transport (`'graphql'` default, or `'rest'`).
 * `'grpc'` is NOT supported in JS and throws. Some methods are available over
 * only one protocol (e.g. AdminMeta is rest-only, GenerateJWTKeys is
 * graphql-only); calling such a method over an unsupported protocol throws a
 * clear error early instead of emitting a 404 / unknown-field.
 */
export class AuthorizerAdmin {
  config: Types.AdminConfigType;

  constructor(config: Types.AdminConfigType) {
    if (!config) throw new Error('Configuration is required');
    if (!config.authorizerURL?.trim())
      throw new Error('Invalid authorizerURL');
    if (!config.adminSecret?.trim()) throw new Error('Invalid adminSecret');

    if ((config.protocol as string) === 'grpc')
      throw new Error(
        'protocol \'grpc\' is not supported in authorizer-js (browsers cannot speak raw gRPC); use \'graphql\' or \'rest\'',
      );

    this.config = {
      ...config,
      authorizerURL: trimURL(config.authorizerURL),
      protocol: config.protocol || 'graphql',
    };
    this.config.extraHeaders = {
      ...(config.extraHeaders || {}),
      'x-authorizer-url': this.config.authorizerURL,
      'x-authorizer-admin-secret': config.adminSecret,
      'Content-Type': 'application/json',
    };
  }

  // ---- transport ----

  // dispatch runs an admin method over the configured protocol. `protocols`
  // lists which protocols the method supports; calling over an unsupported one
  // throws early. The payload is unwrapped to the same shape regardless of
  // protocol so callers get a consistent return type.
  private dispatch = async <T>(
    name: string,
    protocols: Types.Protocol[],
    gql: GqlVariant | null,
    rest: RestVariant | null,
    variables?: Record<string, any>,
    body?: Record<string, unknown>,
  ): Promise<Types.ApiResponse<T>> => {
    const protocol = this.config.protocol as Types.Protocol;
    if (!protocols.includes(protocol)) {
      return this.errorResponse([
        new Error(
          `${name} is not available over ${protocol}; supported: ${protocols.join(', ')}`,
        ),
      ]);
    }
    try {
      if (protocol === 'rest') {
        const res = await this.restCall(rest!.method, rest!.path, body);
        if (res.errors.length) return this.errorResponse(res.errors);
        const data = rest!.unwrap ? res.data?.[rest!.unwrap] : res.data;
        return this.okResponse(data);
      }
      const res = await this.gqlCall(gql!, variables);
      if (res.errors.length) return this.errorResponse(res.errors);
      return this.okResponse(res.data?.[gql!.op]);
    } catch (err) {
      return this.errorResponse(err);
    }
  };

  private gqlCall = async (
    gql: GqlVariant,
    variables?: Record<string, any>,
  ): Promise<{ data?: any; errors: Error[] }> => {
    const fetcher = getFetcher();
    const res = await fetcher(`${this.config.authorizerURL}/graphql`, {
      method: 'POST',
      body: JSON.stringify({
        query: gql.query,
        variables: variables || {},
        operationName: gql.operationName,
      }),
      headers: { ...this.config.extraHeaders },
      credentials: 'include',
    });

    const text = await res.text();
    let json: { data?: any; errors?: unknown[] } = {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        return {
          data: undefined,
          errors: [
            new Error(
              res.ok
                ? 'Invalid JSON from GraphQL endpoint'
                : `HTTP ${res.status}`,
            ),
          ],
        };
      }
    } else if (!res.ok) {
      return { data: undefined, errors: [new Error(`HTTP ${res.status}`)] };
    }
    if (json?.errors?.length)
      return { data: undefined, errors: toErrorList(json.errors) };
    if (!res.ok)
      return { data: undefined, errors: [new Error(`HTTP ${res.status}`)] };
    return { data: json.data, errors: [] };
  };

  private restCall = async (
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
  ): Promise<{ data?: any; errors: Error[] }> => {
    const fetcher = getFetcher();
    const res = await fetcher(`${this.config.authorizerURL}${path}`, {
      method,
      ...(method === 'POST' ? { body: JSON.stringify(body || {}) } : {}),
      headers: { ...this.config.extraHeaders },
      credentials: 'include',
    });

    const text = await res.text();
    let json: { error?: string; message?: string } & Record<string, unknown> =
      {};
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        return {
          data: undefined,
          errors: [
            new Error(
              res.ok ? 'Invalid JSON from REST endpoint' : `HTTP ${res.status}`,
            ),
          ],
        };
      }
    } else if (!res.ok) {
      return { data: undefined, errors: [new Error(`HTTP ${res.status}`)] };
    }
    if (!res.ok) {
      return {
        data: undefined,
        errors: [
          new Error(String(json.message || json.error || `HTTP ${res.status}`)),
        ],
      };
    }
    // proto-gateway serializes int64 fields (pagination limit/page/offset/total,
    // timestamps, expires) as strings; coerce to numbers so the rest path
    // returns the same number-typed shape as the graphql path.
    return { data: coerceInt64Fields(json), errors: [] };
  };

  private errorResponse = (errors: unknown): Types.ApiResponse<any> => ({
    data: undefined,
    errors: toErrorList(errors),
  });

  private okResponse = (data: any): Types.ApiResponse<any> => ({
    data,
    errors: [],
  });

  // ---- Admin auth + meta ----

  // adminLogin validates the admin secret and establishes an admin session
  // (Set-Cookie for browser callers).
  adminLogin = (
    data: Types.AdminLoginRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'AdminLogin',
      ['graphql', 'rest'],
      {
        query:
          'mutation _admin_login($params: AdminLoginRequest!) { _admin_login(params: $params) { message } }',
        operationName: '_admin_login',
        op: '_admin_login',
      },
      { method: 'POST', path: '/v1/admin/login' },
      { params: data },
      data as unknown as Record<string, unknown>,
    );

  // adminLogout clears the admin session cookie. (rest-only in JS.)
  adminLogout = (): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'AdminLogout',
      ['rest'],
      null,
      { method: 'POST', path: '/v1/admin/logout' },
    );

  // adminSession refreshes the admin session cookie. (rest-only in JS.)
  adminSession = (): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'AdminSession',
      ['rest'],
      null,
      { method: 'GET', path: '/v1/admin/session' },
    );

  // adminMeta returns admin-only configuration metadata (configured roles).
  // (rest-only in JS.)
  adminMeta = (): Promise<Types.ApiResponse<Types.AdminMeta>> =>
    this.dispatch<Types.AdminMeta>(
      'AdminMeta',
      ['rest'],
      null,
      { method: 'GET', path: '/v1/admin/meta', unwrap: 'admin_meta' },
    );

  // ---- Users ----

  // users returns a paginated list of all users.
  users = (
    params?: Types.ListUsersRequest,
  ): Promise<Types.ApiResponse<Types.Users>> =>
    this.dispatch<Types.Users>(
      'Users',
      ['graphql', 'rest'],
      {
        query: `query _users($params: ListUsersRequest) { _users(params: $params) { pagination { ${paginationFragment} } users { ${userFragment} } } }`,
        operationName: '_users',
        op: '_users',
      },
      { method: 'POST', path: '/v1/admin/users' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // user returns a single user by id or email.
  user = (
    params: Types.GetUserRequest,
  ): Promise<Types.ApiResponse<Types.User>> =>
    this.dispatch<Types.User>(
      'User',
      ['graphql', 'rest'],
      {
        query: `query _user($params: GetUserRequest!) { _user(params: $params) { ${userFragment} } }`,
        operationName: '_user',
        op: '_user',
      },
      { method: 'POST', path: '/v1/admin/user', unwrap: 'user' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // updateUser updates a user's profile, roles, MFA, or verification state.
  updateUser = (
    params: Types.UpdateUserRequest,
  ): Promise<Types.ApiResponse<Types.User>> =>
    this.dispatch<Types.User>(
      'UpdateUser',
      ['graphql', 'rest'],
      {
        query: `mutation _update_user($params: UpdateUserRequest!) { _update_user(params: $params) { ${userFragment} } }`,
        operationName: '_update_user',
        op: '_update_user',
      },
      { method: 'POST', path: '/v1/admin/update_user', unwrap: 'user' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // deleteUser deletes a user (and associated OTP/verification data) by email.
  // DESTRUCTIVE: the user and their auth artifacts are permanently removed.
  deleteUser = (
    params: Types.DeleteUserRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteUser',
      ['graphql', 'rest'],
      {
        query:
          'mutation _delete_user($params: DeleteUserRequest!) { _delete_user(params: $params) { message } }',
        operationName: '_delete_user',
        op: '_delete_user',
      },
      { method: 'POST', path: '/v1/admin/delete_user' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // verificationRequests returns a paginated list of pending verification requests.
  verificationRequests = (
    params?: Types.PaginatedRequest,
  ): Promise<Types.ApiResponse<Types.VerificationRequests>> =>
    this.dispatch<Types.VerificationRequests>(
      'VerificationRequests',
      ['graphql', 'rest'],
      {
        query: `query _verification_requests($params: PaginatedRequest) { _verification_requests(params: $params) { pagination { ${paginationFragment} } verification_requests { id identifier token email expires created_at updated_at nonce redirect_uri } } }`,
        operationName: '_verification_requests',
        op: '_verification_requests',
      },
      { method: 'POST', path: '/v1/admin/verification_requests' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // ---- Access ----

  // revokeAccess revokes a user's access, kills their sessions, and fires the
  // access-revoked webhook.
  revokeAccess = (
    params: Types.UpdateAccessRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'RevokeAccess',
      ['graphql', 'rest'],
      {
        query:
          'mutation _revoke_access($param: UpdateAccessRequest!) { _revoke_access(param: $param) { message } }',
        operationName: '_revoke_access',
        op: '_revoke_access',
      },
      { method: 'POST', path: '/v1/admin/revoke_access' },
      { param: params },
      params as unknown as Record<string, unknown>,
    );

  // enableAccess re-enables a previously revoked user and fires the
  // access-enabled webhook.
  enableAccess = (
    params: Types.UpdateAccessRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'EnableAccess',
      ['graphql', 'rest'],
      {
        query:
          'mutation _enable_access($param: UpdateAccessRequest!) { _enable_access(param: $param) { message } }',
        operationName: '_enable_access',
        op: '_enable_access',
      },
      { method: 'POST', path: '/v1/admin/enable_access' },
      { param: params },
      params as unknown as Record<string, unknown>,
    );

  // inviteMembers creates accounts for new emails and sends invite emails
  // (requires a configured email service).
  inviteMembers = (
    params: Types.InviteMemberRequest,
  ): Promise<Types.ApiResponse<Types.InviteMembersResponse>> =>
    this.dispatch<Types.InviteMembersResponse>(
      'InviteMembers',
      ['graphql', 'rest'],
      {
        query: `mutation _invite_members($params: InviteMemberRequest!) { _invite_members(params: $params) { message Users { ${userFragment} } } }`,
        operationName: '_invite_members',
        op: '_invite_members',
      },
      { method: 'POST', path: '/v1/admin/invite_members' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // ---- Webhooks ----

  // addWebhook registers a new webhook for an event.
  addWebhook = (
    params: Types.AddWebhookRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'AddWebhook',
      ['graphql', 'rest'],
      {
        query:
          'mutation _add_webhook($params: AddWebhookRequest!) { _add_webhook(params: $params) { message } }',
        operationName: '_add_webhook',
        op: '_add_webhook',
      },
      { method: 'POST', path: '/v1/admin/add_webhook' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // updateWebhook updates an existing webhook.
  updateWebhook = (
    params: Types.UpdateWebhookRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'UpdateWebhook',
      ['graphql', 'rest'],
      {
        query:
          'mutation _update_webhook($params: UpdateWebhookRequest!) { _update_webhook(params: $params) { message } }',
        operationName: '_update_webhook',
        op: '_update_webhook',
      },
      { method: 'POST', path: '/v1/admin/update_webhook' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // deleteWebhook deletes a webhook by id. DESTRUCTIVE: the webhook config is
  // permanently removed.
  deleteWebhook = (
    params: Types.WebhookRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteWebhook',
      ['graphql', 'rest'],
      {
        query:
          'mutation _delete_webhook($params: WebhookRequest!) { _delete_webhook(params: $params) { message } }',
        operationName: '_delete_webhook',
        op: '_delete_webhook',
      },
      { method: 'POST', path: '/v1/admin/delete_webhook' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // getWebhook returns a single webhook by id.
  getWebhook = (
    params: Types.WebhookRequest,
  ): Promise<Types.ApiResponse<Types.Webhook>> =>
    this.dispatch<Types.Webhook>(
      'GetWebhook',
      ['graphql', 'rest'],
      {
        query: `query _webhook($params: WebhookRequest!) { _webhook(params: $params) { ${webhookFragment} } }`,
        operationName: '_webhook',
        op: '_webhook',
      },
      { method: 'POST', path: '/v1/admin/webhook', unwrap: 'webhook' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // webhooks returns a paginated list of webhooks.
  webhooks = (
    params?: Types.PaginatedRequest,
  ): Promise<Types.ApiResponse<Types.Webhooks>> =>
    this.dispatch<Types.Webhooks>(
      'Webhooks',
      ['graphql', 'rest'],
      {
        query: `query _webhooks($params: PaginatedRequest) { _webhooks(params: $params) { pagination { ${paginationFragment} } webhooks { ${webhookFragment} } } }`,
        operationName: '_webhooks',
        op: '_webhooks',
      },
      { method: 'POST', path: '/v1/admin/webhooks' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // webhookLogs returns a paginated list of webhook delivery logs, optionally
  // filtered by webhook id.
  webhookLogs = (
    params?: Types.ListWebhookLogRequest,
  ): Promise<Types.ApiResponse<Types.WebhookLogs>> =>
    this.dispatch<Types.WebhookLogs>(
      'WebhookLogs',
      ['graphql', 'rest'],
      {
        query: `query _webhook_logs($params: ListWebhookLogRequest) { _webhook_logs(params: $params) { pagination { ${paginationFragment} } webhook_logs { ${webhookLogFragment} } } }`,
        operationName: '_webhook_logs',
        op: '_webhook_logs',
      },
      { method: 'POST', path: '/v1/admin/webhook_logs' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // testEndpoint sends a synthetic event payload to a webhook endpoint and
  // returns the HTTP status and response body.
  testEndpoint = (
    params: Types.TestEndpointRequest,
  ): Promise<Types.ApiResponse<Types.TestEndpointResponse>> =>
    this.dispatch<Types.TestEndpointResponse>(
      'TestEndpoint',
      ['graphql', 'rest'],
      {
        query:
          'mutation _test_endpoint($params: TestEndpointRequest!) { _test_endpoint(params: $params) { http_status response } }',
        operationName: '_test_endpoint',
        op: '_test_endpoint',
      },
      { method: 'POST', path: '/v1/admin/test_endpoint' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // ---- Email templates ----

  // addEmailTemplate creates a new email template for an event.
  addEmailTemplate = (
    params: Types.AddEmailTemplateRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'AddEmailTemplate',
      ['graphql', 'rest'],
      {
        query:
          'mutation _add_email_template($params: AddEmailTemplateRequest!) { _add_email_template(params: $params) { message } }',
        operationName: '_add_email_template',
        op: '_add_email_template',
      },
      { method: 'POST', path: '/v1/admin/add_email_template' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // updateEmailTemplate updates an existing email template.
  updateEmailTemplate = (
    params: Types.UpdateEmailTemplateRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'UpdateEmailTemplate',
      ['graphql', 'rest'],
      {
        query:
          'mutation _update_email_template($params: UpdateEmailTemplateRequest!) { _update_email_template(params: $params) { message } }',
        operationName: '_update_email_template',
        op: '_update_email_template',
      },
      { method: 'POST', path: '/v1/admin/update_email_template' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // deleteEmailTemplate deletes an email template by id. DESTRUCTIVE: the
  // template is permanently removed.
  deleteEmailTemplate = (
    params: Types.DeleteEmailTemplateRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteEmailTemplate',
      ['graphql', 'rest'],
      {
        query:
          'mutation _delete_email_template($params: DeleteEmailTemplateRequest!) { _delete_email_template(params: $params) { message } }',
        operationName: '_delete_email_template',
        op: '_delete_email_template',
      },
      { method: 'POST', path: '/v1/admin/delete_email_template' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // emailTemplates returns a paginated list of email templates.
  emailTemplates = (
    params?: Types.PaginatedRequest,
  ): Promise<Types.ApiResponse<Types.EmailTemplates>> =>
    this.dispatch<Types.EmailTemplates>(
      'EmailTemplates',
      ['graphql', 'rest'],
      {
        query: `query _email_templates($params: PaginatedRequest) { _email_templates(params: $params) { pagination { ${paginationFragment} } email_templates { ${emailTemplateFragment} } } }`,
        operationName: '_email_templates',
        op: '_email_templates',
      },
      { method: 'POST', path: '/v1/admin/email_templates' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // ---- Audit ----

  // auditLogs returns a paginated, optionally-filtered list of audit log entries.
  auditLogs = (
    params?: Types.ListAuditLogRequest,
  ): Promise<Types.ApiResponse<Types.AuditLogs>> =>
    this.dispatch<Types.AuditLogs>(
      'AuditLogs',
      ['graphql', 'rest'],
      {
        query: `query _audit_logs($params: ListAuditLogRequest) { _audit_logs(params: $params) { pagination { ${paginationFragment} } audit_logs { ${auditLogFragment} } } }`,
        operationName: '_audit_logs',
        op: '_audit_logs',
      },
      { method: 'POST', path: '/v1/admin/audit_logs' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // ---- FGA (fine-grained authorization) admin ----

  // fgaGetModel returns the active fine-grained authorization model as DSL.
  // (rest-only in JS.)
  fgaGetModel = (): Promise<Types.ApiResponse<Types.FgaModel>> =>
    this.dispatch<Types.FgaModel>(
      'FgaGetModel',
      ['rest'],
      null,
      { method: 'GET', path: '/v1/admin/fga/model', unwrap: 'model' },
    );

  // fgaWriteModel installs a new fine-grained authorization model from its DSL.
  // DESTRUCTIVE: replaces the active authorization model.
  fgaWriteModel = (
    params: Types.FgaWriteModelInput,
  ): Promise<Types.ApiResponse<Types.FgaModel>> =>
    this.dispatch<Types.FgaModel>(
      'FgaWriteModel',
      ['graphql', 'rest'],
      {
        query:
          'mutation _fga_write_model($params: FgaWriteModelInput!) { _fga_write_model(params: $params) { id dsl } }',
        operationName: '_fga_write_model',
        op: '_fga_write_model',
      },
      { method: 'POST', path: '/v1/admin/fga/model', unwrap: 'model' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // fgaWriteTuples persists the given relationship tuples (additive).
  fgaWriteTuples = (
    params: Types.FgaWriteTuplesInput,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'FgaWriteTuples',
      ['graphql', 'rest'],
      {
        query:
          'mutation _fga_write_tuples($params: FgaWriteTuplesInput!) { _fga_write_tuples(params: $params) { message } }',
        operationName: '_fga_write_tuples',
        op: '_fga_write_tuples',
      },
      { method: 'POST', path: '/v1/admin/fga/tuples' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // fgaDeleteTuples removes the given relationship tuples. DESTRUCTIVE: the
  // listed tuples are permanently removed.
  fgaDeleteTuples = (
    params: Types.FgaWriteTuplesInput,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'FgaDeleteTuples',
      ['graphql', 'rest'],
      {
        query:
          'mutation _fga_delete_tuples($params: FgaWriteTuplesInput!) { _fga_delete_tuples(params: $params) { message } }',
        operationName: '_fga_delete_tuples',
        op: '_fga_delete_tuples',
      },
      { method: 'POST', path: '/v1/admin/fga/tuples/delete' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // fgaReadTuples returns a page of persisted tuples matching the filter.
  fgaReadTuples = (
    params: Types.FgaReadTuplesInput,
  ): Promise<Types.ApiResponse<Types.FgaTuples>> =>
    this.dispatch<Types.FgaTuples>(
      'FgaReadTuples',
      ['graphql', 'rest'],
      {
        query:
          'query _fga_read_tuples($params: FgaReadTuplesInput!) { _fga_read_tuples(params: $params) { tuples { user relation object } continuation_token } }',
        operationName: '_fga_read_tuples',
        op: '_fga_read_tuples',
      },
      { method: 'POST', path: '/v1/admin/fga/tuples/read' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // fgaListUsers returns the fully-qualified user ids of user_type that have
  // relation on object ("who can access this object?").
  fgaListUsers = (
    params: Types.FgaListUsersInput,
  ): Promise<Types.ApiResponse<Types.FgaListUsersResponse>> =>
    this.dispatch<Types.FgaListUsersResponse>(
      'FgaListUsers',
      ['graphql', 'rest'],
      {
        query:
          'query _fga_list_users($params: FgaListUsersInput!) { _fga_list_users(params: $params) { users } }',
        operationName: '_fga_list_users',
        op: '_fga_list_users',
      },
      { method: 'POST', path: '/v1/admin/fga/list_users' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // fgaExpand returns the OpenFGA relationship/userset tree for (relation,
  // object) as a JSON string.
  fgaExpand = (
    params: Types.FgaExpandInput,
  ): Promise<Types.ApiResponse<Types.FgaExpandResponse>> =>
    this.dispatch<Types.FgaExpandResponse>(
      'FgaExpand',
      ['graphql', 'rest'],
      {
        query:
          'query _fga_expand($params: FgaExpandInput!) { _fga_expand(params: $params) { tree } }',
        operationName: '_fga_expand',
        op: '_fga_expand',
      },
      { method: 'POST', path: '/v1/admin/fga/expand' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // fgaReset deletes the entire fine-grained authorization store (the model,
  // all its versions, and all tuples) and starts a fresh, empty store. Refused
  // while any tuples still exist. DESTRUCTIVE. (rest-only in JS.)
  fgaReset = (): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'FgaReset',
      ['rest'],
      null,
      { method: 'POST', path: '/v1/admin/fga/reset' },
    );

  // ---- OAuth clients (service accounts) ----

  // createClient registers a new OAuth client / service account. The returned
  // client_secret is shown ONCE and can never be retrieved again.
  createClient = (
    params: Types.CreateClientRequest,
  ): Promise<Types.ApiResponse<Types.CreateClientResponse>> =>
    this.dispatch<Types.CreateClientResponse>(
      'CreateClient',
      ['graphql', 'rest'],
      {
        query: `mutation _create_client($params: CreateClientRequest!) { _create_client(params: $params) { client { ${clientFragment} } client_secret } }`,
        operationName: '_create_client',
        op: '_create_client',
      },
      { method: 'POST', path: '/v1/admin/create_client' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // updateClient updates a client's name, description, scopes, or active state.
  updateClient = (
    params: Types.UpdateClientRequest,
  ): Promise<Types.ApiResponse<Types.Client>> =>
    this.dispatch<Types.Client>(
      'UpdateClient',
      ['graphql', 'rest'],
      {
        query: `mutation _update_client($params: UpdateClientRequest!) { _update_client(params: $params) { ${clientFragment} } }`,
        operationName: '_update_client',
        op: '_update_client',
      },
      { method: 'POST', path: '/v1/admin/update_client', unwrap: 'client' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // deleteClient deletes a client by id. DESTRUCTIVE: the client and its
  // credential are permanently removed.
  deleteClient = (
    params: Types.ClientRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteClient',
      ['graphql', 'rest'],
      {
        query:
          'mutation _delete_client($params: ClientRequest!) { _delete_client(params: $params) { message } }',
        operationName: '_delete_client',
        op: '_delete_client',
      },
      { method: 'POST', path: '/v1/admin/delete_client' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // rotateClientSecret mints a fresh secret for the client. The new secret is
  // shown ONCE; the old secret stops working immediately.
  rotateClientSecret = (
    params: Types.ClientRequest,
  ): Promise<Types.ApiResponse<Types.CreateClientResponse>> =>
    this.dispatch<Types.CreateClientResponse>(
      'RotateClientSecret',
      ['graphql', 'rest'],
      {
        query: `mutation _rotate_client_secret($params: ClientRequest!) { _rotate_client_secret(params: $params) { client { ${clientFragment} } client_secret } }`,
        operationName: '_rotate_client_secret',
        op: '_rotate_client_secret',
      },
      { method: 'POST', path: '/v1/admin/rotate_client_secret' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // client returns a single client by id (never includes the secret).
  client = (
    params: Types.ClientRequest,
  ): Promise<Types.ApiResponse<Types.Client>> =>
    this.dispatch<Types.Client>(
      'GetClient',
      ['graphql', 'rest'],
      {
        query: `query _client($params: ClientRequest!) { _client(params: $params) { ${clientFragment} } }`,
        operationName: '_client',
        op: '_client',
      },
      { method: 'POST', path: '/v1/admin/client', unwrap: 'client' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // clients returns a paginated list of clients.
  clients = (
    params?: Types.ListClientsRequest,
  ): Promise<Types.ApiResponse<Types.Clients>> =>
    this.dispatch<Types.Clients>(
      'Clients',
      ['graphql', 'rest'],
      {
        query: `query _clients($params: ListClientsRequest) { _clients(params: $params) { pagination { ${paginationFragment} } clients { ${clientFragment} } } }`,
        operationName: '_clients',
        op: '_clients',
      },
      { method: 'POST', path: '/v1/admin/clients' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // ---- Trusted issuers (secretless client authentication) ----

  // addTrustedIssuer registers an external token issuer trusted to
  // authenticate a service account via RFC 7523 client_assertion.
  addTrustedIssuer = (
    params: Types.AddTrustedIssuerRequest,
  ): Promise<Types.ApiResponse<Types.TrustedIssuer>> =>
    this.dispatch<Types.TrustedIssuer>(
      'AddTrustedIssuer',
      ['graphql', 'rest'],
      {
        query: `mutation _add_trusted_issuer($params: AddTrustedIssuerRequest!) { _add_trusted_issuer(params: $params) { ${trustedIssuerFragment} } }`,
        operationName: '_add_trusted_issuer',
        op: '_add_trusted_issuer',
      },
      {
        method: 'POST',
        path: '/v1/admin/add_trusted_issuer',
        unwrap: 'trusted_issuer',
      },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // updateTrustedIssuer updates an existing trusted issuer.
  updateTrustedIssuer = (
    params: Types.UpdateTrustedIssuerRequest,
  ): Promise<Types.ApiResponse<Types.TrustedIssuer>> =>
    this.dispatch<Types.TrustedIssuer>(
      'UpdateTrustedIssuer',
      ['graphql', 'rest'],
      {
        query: `mutation _update_trusted_issuer($params: UpdateTrustedIssuerRequest!) { _update_trusted_issuer(params: $params) { ${trustedIssuerFragment} } }`,
        operationName: '_update_trusted_issuer',
        op: '_update_trusted_issuer',
      },
      {
        method: 'POST',
        path: '/v1/admin/update_trusted_issuer',
        unwrap: 'trusted_issuer',
      },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // deleteTrustedIssuer deletes a trusted issuer by id. DESTRUCTIVE: tokens
  // from that issuer stop authenticating immediately.
  deleteTrustedIssuer = (
    params: Types.TrustedIssuerRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteTrustedIssuer',
      ['graphql', 'rest'],
      {
        query:
          'mutation _delete_trusted_issuer($params: TrustedIssuerRequest!) { _delete_trusted_issuer(params: $params) { message } }',
        operationName: '_delete_trusted_issuer',
        op: '_delete_trusted_issuer',
      },
      { method: 'POST', path: '/v1/admin/delete_trusted_issuer' },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // trustedIssuer returns a single trusted issuer by id.
  trustedIssuer = (
    params: Types.TrustedIssuerRequest,
  ): Promise<Types.ApiResponse<Types.TrustedIssuer>> =>
    this.dispatch<Types.TrustedIssuer>(
      'GetTrustedIssuer',
      ['graphql', 'rest'],
      {
        query: `query _trusted_issuer($params: TrustedIssuerRequest!) { _trusted_issuer(params: $params) { ${trustedIssuerFragment} } }`,
        operationName: '_trusted_issuer',
        op: '_trusted_issuer',
      },
      {
        method: 'POST',
        path: '/v1/admin/trusted_issuer',
        unwrap: 'trusted_issuer',
      },
      { params },
      params as unknown as Record<string, unknown>,
    );

  // trustedIssuers returns a paginated list of trusted issuers, optionally
  // filtered by service account.
  trustedIssuers = (
    params?: Types.ListTrustedIssuersRequest,
  ): Promise<Types.ApiResponse<Types.TrustedIssuers>> =>
    this.dispatch<Types.TrustedIssuers>(
      'TrustedIssuers',
      ['graphql', 'rest'],
      {
        query: `query _trusted_issuers($params: ListTrustedIssuersRequest) { _trusted_issuers(params: $params) { pagination { ${paginationFragment} } trusted_issuers { ${trustedIssuerFragment} } } }`,
        operationName: '_trusted_issuers',
        op: '_trusted_issuers',
      },
      { method: 'POST', path: '/v1/admin/trusted_issuers' },
      { params },
      (params || {}) as Record<string, unknown>,
    );

  // ---- Organizations (graphql-only: no proto/REST routes yet) ----

  // createOrganization creates a new organization.
  createOrganization = (
    params: Types.CreateOrganizationRequest,
  ): Promise<Types.ApiResponse<Types.Organization>> =>
    this.dispatch<Types.Organization>(
      'CreateOrganization',
      ['graphql'],
      {
        query: `mutation _create_organization($params: CreateOrganizationRequest!) { _create_organization(params: $params) { ${organizationFragment} } }`,
        operationName: '_create_organization',
        op: '_create_organization',
      },
      null,
      { params },
    );

  // updateOrganization updates an existing organization.
  updateOrganization = (
    params: Types.UpdateOrganizationRequest,
  ): Promise<Types.ApiResponse<Types.Organization>> =>
    this.dispatch<Types.Organization>(
      'UpdateOrganization',
      ['graphql'],
      {
        query: `mutation _update_organization($params: UpdateOrganizationRequest!) { _update_organization(params: $params) { ${organizationFragment} } }`,
        operationName: '_update_organization',
        op: '_update_organization',
      },
      null,
      { params },
    );

  // deleteOrganization deletes an organization by id. DESTRUCTIVE.
  deleteOrganization = (
    params: Types.OrganizationRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteOrganization',
      ['graphql'],
      {
        query:
          'mutation _delete_organization($params: OrganizationRequest!) { _delete_organization(params: $params) { message } }',
        operationName: '_delete_organization',
        op: '_delete_organization',
      },
      null,
      { params },
    );

  // addOrgMember adds a user to an organization with optional per-org roles.
  addOrgMember = (
    params: Types.AddOrgMemberRequest,
  ): Promise<Types.ApiResponse<Types.OrgMember>> =>
    this.dispatch<Types.OrgMember>(
      'AddOrgMember',
      ['graphql'],
      {
        query: `mutation _add_org_member($params: AddOrgMemberRequest!) { _add_org_member(params: $params) { ${orgMemberFragment} } }`,
        operationName: '_add_org_member',
        op: '_add_org_member',
      },
      null,
      { params },
    );

  // removeOrgMember removes a user from an organization.
  removeOrgMember = (
    params: Types.RemoveOrgMemberRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'RemoveOrgMember',
      ['graphql'],
      {
        query:
          'mutation _remove_org_member($params: RemoveOrgMemberRequest!) { _remove_org_member(params: $params) { message } }',
        operationName: '_remove_org_member',
        op: '_remove_org_member',
      },
      null,
      { params },
    );

  // organization returns a single organization by id.
  organization = (
    params: Types.OrganizationRequest,
  ): Promise<Types.ApiResponse<Types.Organization>> =>
    this.dispatch<Types.Organization>(
      'GetOrganization',
      ['graphql'],
      {
        query: `query _organization($params: OrganizationRequest!) { _organization(params: $params) { ${organizationFragment} } }`,
        operationName: '_organization',
        op: '_organization',
      },
      null,
      { params },
    );

  // organizations returns a paginated list of organizations.
  organizations = (
    params?: Types.ListOrganizationsRequest,
  ): Promise<Types.ApiResponse<Types.Organizations>> =>
    this.dispatch<Types.Organizations>(
      'Organizations',
      ['graphql'],
      {
        query: `query _organizations($params: ListOrganizationsRequest) { _organizations(params: $params) { pagination { ${paginationFragment} } organizations { ${organizationFragment} } } }`,
        operationName: '_organizations',
        op: '_organizations',
      },
      null,
      { params },
    );

  // orgMembers returns a paginated list of an organization's members.
  orgMembers = (
    params: Types.ListOrgMembersRequest,
  ): Promise<Types.ApiResponse<Types.OrgMembers>> =>
    this.dispatch<Types.OrgMembers>(
      'OrgMembers',
      ['graphql'],
      {
        query: `query _org_members($params: ListOrgMembersRequest!) { _org_members(params: $params) { pagination { ${paginationFragment} } org_members { ${orgMemberFragment} } } }`,
        operationName: '_org_members',
        op: '_org_members',
      },
      null,
      { params },
    );

  // userOrganizations returns the organizations a user belongs to along with
  // the roles held in each.
  userOrganizations = (
    params: Types.UserOrganizationsRequest,
  ): Promise<Types.ApiResponse<Types.UserOrganizations>> =>
    this.dispatch<Types.UserOrganizations>(
      'UserOrganizations',
      ['graphql'],
      {
        query: `query _user_organizations($params: UserOrganizationsRequest!) { _user_organizations(params: $params) { pagination { ${paginationFragment} } user_organizations { organization { ${organizationFragment} } roles } } }`,
        operationName: '_user_organizations',
        op: '_user_organizations',
      },
      null,
      { params },
    );

  // ---- Org SSO connections (graphql-only: no proto/REST routes yet) ----

  // createOrgOIDCConnection registers a per-org upstream OIDC IdP (Authorizer
  // as Relying Party). The upstream client_secret is stored encrypted and
  // never returned.
  createOrgOIDCConnection = (
    params: Types.CreateOrgOIDCConnectionRequest,
  ): Promise<Types.ApiResponse<Types.OrgOIDCConnection>> =>
    this.dispatch<Types.OrgOIDCConnection>(
      'CreateOrgOIDCConnection',
      ['graphql'],
      {
        query: `mutation _create_org_oidc_connection($params: CreateOrgOIDCConnectionRequest!) { _create_org_oidc_connection(params: $params) { ${orgOIDCConnectionFragment} } }`,
        operationName: '_create_org_oidc_connection',
        op: '_create_org_oidc_connection',
      },
      null,
      { params },
    );

  // updateOrgOIDCConnection updates a per-org upstream OIDC connection.
  updateOrgOIDCConnection = (
    params: Types.UpdateOrgOIDCConnectionRequest,
  ): Promise<Types.ApiResponse<Types.OrgOIDCConnection>> =>
    this.dispatch<Types.OrgOIDCConnection>(
      'UpdateOrgOIDCConnection',
      ['graphql'],
      {
        query: `mutation _update_org_oidc_connection($params: UpdateOrgOIDCConnectionRequest!) { _update_org_oidc_connection(params: $params) { ${orgOIDCConnectionFragment} } }`,
        operationName: '_update_org_oidc_connection',
        op: '_update_org_oidc_connection',
      },
      null,
      { params },
    );

  // deleteOrgOIDCConnection deletes a per-org upstream OIDC connection.
  // DESTRUCTIVE: SSO via that IdP stops working immediately.
  deleteOrgOIDCConnection = (
    params: Types.OrgOIDCConnectionRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteOrgOIDCConnection',
      ['graphql'],
      {
        query:
          'mutation _delete_org_oidc_connection($params: OrgOIDCConnectionRequest!) { _delete_org_oidc_connection(params: $params) { message } }',
        operationName: '_delete_org_oidc_connection',
        op: '_delete_org_oidc_connection',
      },
      null,
      { params },
    );

  // orgOIDCConnection returns a per-org upstream OIDC connection by id OR
  // org_id (supply exactly one).
  orgOIDCConnection = (
    params: Types.OrgOIDCConnectionRequest,
  ): Promise<Types.ApiResponse<Types.OrgOIDCConnection>> =>
    this.dispatch<Types.OrgOIDCConnection>(
      'GetOrgOIDCConnection',
      ['graphql'],
      {
        query: `query _org_oidc_connection($params: OrgOIDCConnectionRequest!) { _org_oidc_connection(params: $params) { ${orgOIDCConnectionFragment} } }`,
        operationName: '_org_oidc_connection',
        op: '_org_oidc_connection',
      },
      null,
      { params },
    );

  // createOrgSAMLConnection registers a per-org upstream SAML 2.0 IdP
  // (Authorizer as Service Provider). The IdP certificate is accepted on
  // write but never returned.
  createOrgSAMLConnection = (
    params: Types.CreateOrgSAMLConnectionRequest,
  ): Promise<Types.ApiResponse<Types.OrgSAMLConnection>> =>
    this.dispatch<Types.OrgSAMLConnection>(
      'CreateOrgSAMLConnection',
      ['graphql'],
      {
        query: `mutation _create_org_saml_connection($params: CreateOrgSAMLConnectionRequest!) { _create_org_saml_connection(params: $params) { ${orgSAMLConnectionFragment} } }`,
        operationName: '_create_org_saml_connection',
        op: '_create_org_saml_connection',
      },
      null,
      { params },
    );

  // updateOrgSAMLConnection updates a per-org upstream SAML connection.
  updateOrgSAMLConnection = (
    params: Types.UpdateOrgSAMLConnectionRequest,
  ): Promise<Types.ApiResponse<Types.OrgSAMLConnection>> =>
    this.dispatch<Types.OrgSAMLConnection>(
      'UpdateOrgSAMLConnection',
      ['graphql'],
      {
        query: `mutation _update_org_saml_connection($params: UpdateOrgSAMLConnectionRequest!) { _update_org_saml_connection(params: $params) { ${orgSAMLConnectionFragment} } }`,
        operationName: '_update_org_saml_connection',
        op: '_update_org_saml_connection',
      },
      null,
      { params },
    );

  // deleteOrgSAMLConnection deletes a per-org upstream SAML connection.
  // DESTRUCTIVE: SSO via that IdP stops working immediately.
  deleteOrgSAMLConnection = (
    params: Types.OrgSAMLConnectionRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteOrgSAMLConnection',
      ['graphql'],
      {
        query:
          'mutation _delete_org_saml_connection($params: OrgSAMLConnectionRequest!) { _delete_org_saml_connection(params: $params) { message } }',
        operationName: '_delete_org_saml_connection',
        op: '_delete_org_saml_connection',
      },
      null,
      { params },
    );

  // orgSAMLConnection returns a per-org upstream SAML connection by id OR
  // org_id (supply exactly one).
  orgSAMLConnection = (
    params: Types.OrgSAMLConnectionRequest,
  ): Promise<Types.ApiResponse<Types.OrgSAMLConnection>> =>
    this.dispatch<Types.OrgSAMLConnection>(
      'GetOrgSAMLConnection',
      ['graphql'],
      {
        query: `query _org_saml_connection($params: OrgSAMLConnectionRequest!) { _org_saml_connection(params: $params) { ${orgSAMLConnectionFragment} } }`,
        operationName: '_org_saml_connection',
        op: '_org_saml_connection',
      },
      null,
      { params },
    );

  // ---- SCIM endpoints (graphql-only: no proto/REST routes yet) ----

  // createScimEndpoint provisions the org's inbound SCIM 2.0 endpoint. The
  // returned bearer token is shown ONCE and can never be retrieved again.
  createScimEndpoint = (
    params: Types.CreateScimEndpointRequest,
  ): Promise<Types.ApiResponse<Types.CreateScimEndpointResponse>> =>
    this.dispatch<Types.CreateScimEndpointResponse>(
      'CreateScimEndpoint',
      ['graphql'],
      {
        query: `mutation _create_scim_endpoint($params: CreateScimEndpointRequest!) { _create_scim_endpoint(params: $params) { scim_endpoint { ${scimEndpointFragment} } token } }`,
        operationName: '_create_scim_endpoint',
        op: '_create_scim_endpoint',
      },
      null,
      { params },
    );

  // rotateScimToken mints a fresh SCIM bearer token for the org. The new
  // token is shown ONCE; the old token stops working immediately.
  rotateScimToken = (
    params: Types.ScimEndpointRequest,
  ): Promise<Types.ApiResponse<Types.CreateScimEndpointResponse>> =>
    this.dispatch<Types.CreateScimEndpointResponse>(
      'RotateScimToken',
      ['graphql'],
      {
        query: `mutation _rotate_scim_token($params: ScimEndpointRequest!) { _rotate_scim_token(params: $params) { scim_endpoint { ${scimEndpointFragment} } token } }`,
        operationName: '_rotate_scim_token',
        op: '_rotate_scim_token',
      },
      null,
      { params },
    );

  // deleteScimEndpoint removes the org's SCIM endpoint. DESTRUCTIVE: inbound
  // SCIM provisioning stops immediately.
  deleteScimEndpoint = (
    params: Types.ScimEndpointRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteScimEndpoint',
      ['graphql'],
      {
        query:
          'mutation _delete_scim_endpoint($params: ScimEndpointRequest!) { _delete_scim_endpoint(params: $params) { message } }',
        operationName: '_delete_scim_endpoint',
        op: '_delete_scim_endpoint',
      },
      null,
      { params },
    );

  // scimEndpoint returns the org's SCIM endpoint (never includes the token).
  scimEndpoint = (
    params: Types.ScimEndpointRequest,
  ): Promise<Types.ApiResponse<Types.ScimEndpoint>> =>
    this.dispatch<Types.ScimEndpoint>(
      'GetScimEndpoint',
      ['graphql'],
      {
        query: `query _scim_endpoint($params: ScimEndpointRequest!) { _scim_endpoint(params: $params) { ${scimEndpointFragment} } }`,
        operationName: '_scim_endpoint',
        op: '_scim_endpoint',
      },
      null,
      { params },
    );

  // ---- Org verified domains (graphql-only: no proto/REST routes yet) ----

  // requestOrgDomain starts domain verification for an org, returning the DNS
  // TXT challenge the tenant must publish.
  requestOrgDomain = (
    params: Types.RequestOrgDomainRequest,
  ): Promise<Types.ApiResponse<Types.OrgDomainChallenge>> =>
    this.dispatch<Types.OrgDomainChallenge>(
      'RequestOrgDomain',
      ['graphql'],
      {
        query:
          'mutation _request_org_domain($params: RequestOrgDomainRequest!) { _request_org_domain(params: $params) { domain record_type record_name record_value } }',
        operationName: '_request_org_domain',
        op: '_request_org_domain',
      },
      null,
      { params },
    );

  // verifyOrgDomain checks the published DNS challenge and, on success, records
  // the verified domain.
  verifyOrgDomain = (
    params: Types.VerifyOrgDomainRequest,
  ): Promise<Types.ApiResponse<Types.OrgDomain>> =>
    this.dispatch<Types.OrgDomain>(
      'VerifyOrgDomain',
      ['graphql'],
      {
        query: `mutation _verify_org_domain($params: VerifyOrgDomainRequest!) { _verify_org_domain(params: $params) { ${orgDomainFragment} } }`,
        operationName: '_verify_org_domain',
        op: '_verify_org_domain',
      },
      null,
      { params },
    );

  // addVerifiedOrgDomain records a verified domain without a DNS challenge
  // (super-admin only, trusted-assert).
  addVerifiedOrgDomain = (
    params: Types.AddVerifiedOrgDomainRequest,
  ): Promise<Types.ApiResponse<Types.OrgDomain>> =>
    this.dispatch<Types.OrgDomain>(
      'AddVerifiedOrgDomain',
      ['graphql'],
      {
        query: `mutation _add_verified_org_domain($params: AddVerifiedOrgDomainRequest!) { _add_verified_org_domain(params: $params) { ${orgDomainFragment} } }`,
        operationName: '_add_verified_org_domain',
        op: '_add_verified_org_domain',
      },
      null,
      { params },
    );

  // deleteOrgDomain removes a verified domain by domain. DESTRUCTIVE: home-realm
  // discovery for that domain stops immediately.
  deleteOrgDomain = (
    params: Types.DeleteOrgDomainRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'DeleteOrgDomain',
      ['graphql'],
      {
        query:
          'mutation _delete_org_domain($params: DeleteOrgDomainRequest!) { _delete_org_domain(params: $params) { message } }',
        operationName: '_delete_org_domain',
        op: '_delete_org_domain',
      },
      null,
      { params },
    );

  // orgDomains returns a paginated list of an organization's verified domains.
  orgDomains = (
    params: Types.ListOrgDomainsRequest,
  ): Promise<Types.ApiResponse<Types.OrgDomains>> =>
    this.dispatch<Types.OrgDomains>(
      'OrgDomains',
      ['graphql'],
      {
        query: `query _org_domains($params: ListOrgDomainsRequest!) { _org_domains(params: $params) { pagination { ${paginationFragment} } org_domains { ${orgDomainFragment} } } }`,
        operationName: '_org_domains',
        op: '_org_domains',
      },
      null,
      { params },
    );

  // ---- gql-only extras (no proto / no rest) ----

  // adminSignup sets the admin secret on a fresh deployment. (graphql-only.)
  adminSignup = (
    params: Types.AdminSignupRequest,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'AdminSignup',
      ['graphql'],
      {
        query:
          'mutation _admin_signup($params: AdminSignupRequest!) { _admin_signup(params: $params) { message } }',
        operationName: '_admin_signup',
        op: '_admin_signup',
      },
      null,
      { params },
    );

  // updateEnv updates server environment configuration. (graphql-only.)
  // `params` mirrors the GraphQL UpdateEnvRequest input (free-form config keys).
  updateEnv = (
    params: Record<string, any>,
  ): Promise<Types.ApiResponse<Types.Response>> =>
    this.dispatch<Types.Response>(
      'UpdateEnv',
      ['graphql'],
      {
        query:
          'mutation _update_env($params: UpdateEnvRequest!) { _update_env(params: $params) { message } }',
        operationName: '_update_env',
        op: '_update_env',
      },
      null,
      { params },
    );

  // generateJWTKeys generates a fresh secret / key pair of the given type.
  // (graphql-only.)
  generateJWTKeys = (
    params: Types.GenerateJWTKeysRequest,
  ): Promise<Types.ApiResponse<Types.GenerateJWTKeysResponse>> =>
    this.dispatch<Types.GenerateJWTKeysResponse>(
      'GenerateJWTKeys',
      ['graphql'],
      {
        query:
          'query _generate_jwt_keys($params: GenerateJWTKeysRequest!) { _generate_jwt_keys(params: $params) { secret public_key private_key } }',
        operationName: '_generate_jwt_keys',
        op: '_generate_jwt_keys',
      },
      null,
      { params },
    );
}
