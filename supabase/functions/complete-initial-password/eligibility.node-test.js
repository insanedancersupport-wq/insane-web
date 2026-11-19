import assert from 'node:assert/strict'
import test from 'node:test'

import { hasInvitationProvenance } from './eligibility.js'

test('accepts users created through an invitation', () => {
  assert.equal(hasInvitationProvenance({ invited_at: '2026-11-18T18:00:00.000Z' }), true)
})

test('rejects users without invitation provenance', () => {
  assert.equal(hasInvitationProvenance({}), false)
  assert.equal(hasInvitationProvenance({ invited_at: null }), false)
  assert.equal(hasInvitationProvenance(null), false)
})
