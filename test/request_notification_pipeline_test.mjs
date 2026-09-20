import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../site/app.js', import.meta.url), 'utf8');
const portalSource = await readFile(new URL('../site/portal/portal.js', import.meta.url), 'utf8');
const submitLeadSource = await readFile(new URL('../supabase/functions/submit-lead/index.ts', import.meta.url), 'utf8');
const notifierSource = await readFile(new URL('../supabase/functions/notify-service-request/index.ts', import.meta.url), 'utf8');
const notificationMigration = await readFile(new URL('../supabase/migrations/20260920162508_service_request_identity_and_durable_email_notifications_v1_20260920.sql', import.meta.url), 'utf8');
const identityReceiptMigration = await readFile(new URL('../supabase/migrations/20260920162634_authenticated_request_identity_receipt_v1_20260920.sql', import.meta.url), 'utf8');

test('authenticated submissions retain exact request, submission, account and auth-user identity', () => {
  assert.match(identityReceiptMigration, /'submission_id',v_request\.submission_id/);
  assert.match(identityReceiptMigration, /'account_id',v_request\.account_id/);
  assert.match(identityReceiptMigration, /'auth_user_id',v_request\.created_by/);
  assert.match(identityReceiptMigration, /'identity_linked'/);
  assert.match(appSource, /submissionId: result\?\.submission_id/);
  assert.match(appSource, /identityLinked: result\?\.identity_linked === true/);
  assert.match(portalSource, /submission_id,account_id,request_key/);
  assert.match(portalSource, /request\.created_by \? portalData\.users\.find/);
});

test('all non-inline service requests enter the durable notification outbox', () => {
  assert.match(notificationMigration, /private\.service_request_submitter_identity/);
  assert.match(notificationMigration, /private\.service_request_notification_outbox/);
  assert.match(notificationMigration, /zz_service_request_identity_notification_v1/);
  assert.match(notificationMigration, /dispatch_due_service_request_notifications_v1/);
  assert.match(notificationMigration, /induradar-service-request-notifications-v1/);
});

test('public submit-lead no longer sends a parallel Resend email', () => {
  assert.match(submitLeadSource, /notification_email_inline: false/);
  assert.match(submitLeadSource, /email_pending: true/);
  assert.doesNotMatch(submitLeadSource, /api\.resend\.com\/emails/);
});

test('notification edge function claims, sends and persists a provider receipt', () => {
  assert.match(notifierSource, /claim_service_request_notification_v1/);
  assert.match(notifierSource, /complete_service_request_notification_v1/);
  assert.match(notifierSource, /REQUEST_NOTIFICATION_TO_EMAIL/);
  assert.match(notifierSource, /provider_message_id/);
});
