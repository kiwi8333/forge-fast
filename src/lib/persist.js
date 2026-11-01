// Ask the browser to keep this app's data. Without it, browsers may clear a
// website's storage when the phone is low on space, and Safari can clear it
// after a week without a visit (home-screen apps are mostly exempt).
// Returns 'granted', 'denied' or 'unsupported'. Never throws.

export async function storageStatus() {
  try {
    if (!navigator.storage?.persisted) return 'unsupported'
    return (await navigator.storage.persisted()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

export async function requestPersistence() {
  try {
    if (!navigator.storage?.persist) return 'unsupported'
    if (await navigator.storage.persisted()) return 'granted'
    return (await navigator.storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}
