import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertPersonalAction, externalCapabilityNotice } from '../apps/web/components/admin/studio/personal-actions'

test('local CRUD stays available while externally processed actions stop before transmission', () => {
  for (const [path, method] of [['accounts', 'POST'], ['materials', 'POST'], ['drafts/one', 'PATCH'], ['topics/one', 'DELETE']]) {
    assert.doesNotThrow(() => assertPersonalAction(path, method))
  }
  for (const path of ['tasks', 'connections', 'materials/one/prepare', 'materials/one/comments']) {
    assert.throws(() => assertPersonalAction(path, 'POST'), error => error instanceof Error && error.message === externalCapabilityNotice)
  }
  for (const path of ['collections','accounts/one/capture']) assert.throws(() => assertPersonalAction(path,'POST'), /本机采集程序/)
  assert.doesNotThrow(() => assertPersonalAction('materials/one', 'GET'))
})
