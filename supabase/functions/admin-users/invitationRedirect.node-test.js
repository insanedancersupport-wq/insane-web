import assert from 'node:assert/strict'
import test from 'node:test'

import { invitationRedirectUrl } from './invitationRedirect.js'

test('builds the password-setup redirect from a configured application origin', () => {
  assert.equal(
    invitationRedirectUrl('https://app.insanedance.example'),
    'https://app.insanedance.example/set-password',
  )
})

test('accepts an application origin with a trailing slash', () => {
  assert.equal(
    invitationRedirectUrl('http://127.0.0.1:3000/'),
    'http://127.0.0.1:3000/set-password',
  )
})

test('rejects a missing APP_URL', () => {
  assert.throws(() => invitationRedirectUrl(), /APP_URL is required/)
})

test('rejects invalid and non-origin APP_URL values', () => {
  for (const appUrl of [
    'not a URL',
    'ftp://app.insanedance.example',
    'https://app.insanedance.example/application',
    'https://app.insanedance.example/?preview=true',
    'https://user:password@app.insanedance.example',
  ]) {
    assert.throws(() => invitationRedirectUrl(appUrl), /APP_URL/)
  }
})
