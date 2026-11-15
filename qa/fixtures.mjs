// Server-side QA helper. Never import into the application bundle.
export async function cleanupQaFixtures(admin, registry) {
  const failures = []
  async function attempt(label, operation) {
    let lastError
    for (let retry = 0; retry < 3; retry += 1) {
      try { await operation(); return } catch (error) { lastError = error }
    }
    failures.push({ resource: label, message: lastError?.message ?? String(lastError) })
  }
  function requireSuccess(result) { if (result.error) throw result.error; return result.data }

  // Recover identities even if signup succeeded but its response was lost.
  await attempt('discover run users', async () => {
    for (let page = 1; ; page += 1) {
      const { users } = requireSuccess(await admin.auth.admin.listUsers({ page, perPage: 1000 }))
      for (const user of users) {
        if (user.user_metadata?.poruch_qa_run === registry.marker && !registry.users.some(item => item.id === user.id)) {
          registry.users.push({ id: user.id, profileCreated: false })
        }
      }
      if (users.length < 1000) break
    }
  })
  for (const id of registry.eventIds) {
    await attempt(`event:${id}`, async () => {
      requireSuccess(await admin.from('events').delete().eq('id', id))
      const rows = requireSuccess(await admin.from('events').select('id').eq('id', id))
      if (rows.length) throw new Error('Event still exists after cleanup')
    })
  }
  for (const user of registry.users) {
    // Delete/verify profiles explicitly as well as Auth identities.
    // Cascades remove owned events, chat messages, memberships and read states.
    await attempt(`profile:${user.id}`, async () => {
      requireSuccess(await admin.from('users').delete().eq('id', user.id))
      const rows = requireSuccess(await admin.from('users').select('id').eq('id', user.id))
      if (rows.length) throw new Error('Profile still exists after cleanup')
    })
    await attempt(`auth:${user.id}`, async () => {
      const before = await admin.auth.admin.getUserById(user.id)
      if (before.error?.status === 404 || before.error?.code === 'user_not_found') return
      requireSuccess(before)
      requireSuccess(await admin.auth.admin.deleteUser(user.id, false))
      const after = await admin.auth.admin.getUserById(user.id)
      if (after.error?.status === 404 || after.error?.code === 'user_not_found') return
      requireSuccess(after)
      if (after.data?.user) throw new Error('Auth user still exists after cleanup')
    })
  }
  return failures
}
