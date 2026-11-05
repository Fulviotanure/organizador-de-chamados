const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- Executing ConciliadorAPI Role Scoping & Dev Mode Tests ---');

const apiCode = fs.readFileSync(path.join(__dirname, '../src/js/api.js'), 'utf8');

// Test 1: Role prefix resolution
{
  console.log('Test 1: Role prefix resolution');
  const context = {
    window: {},
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  };
  vm.createContext(context);
  vm.runInContext(apiCode, context);
  const api = context.window.conciliadorAPI;

  // Default without user
  assert.strictEqual(api.getRolePrefix(), 'support', 'Default prefix should be support');

  // Developer role
  api.setUser({ role: 'developer' });
  assert.strictEqual(api.getRolePrefix(), 'developer', 'Should detect developer role');

  // Dev shorthand
  api.setUser({ role: 'dev' });
  assert.strictEqual(api.getRolePrefix(), 'developer', 'Should detect dev shorthand');

  // Support role
  api.setUser({ role: 'support' });
  assert.strictEqual(api.getRolePrefix(), 'support', 'Should detect support role');

  // Fallback to window.appStore.currentUser if api.user is null
  api.setUser(null);
  context.window.appStore = { currentUser: { role: 'developer' } };
  assert.strictEqual(api.getRolePrefix(), 'developer', 'Should fallback to appStore.currentUser role');
}

// Test 2: Attachment download URL formatting
{
  console.log('Test 2: Attachment download URL formatting');
  const context = {
    window: {},
    fetch: () => Promise.resolve({ ok: true })
  };
  vm.createContext(context);
  vm.runInContext(apiCode, context);
  const api = context.window.conciliadorAPI;

  api.setUser({ role: 'developer' });
  const devUrl = api.getAttachmentDownloadUrl('dem-123', 'att-456');
  assert.strictEqual(devUrl, 'https://api.importer.conciliadorcontabil.com.br/api/v1/developer/tickets/dem-123/attachments/att-456/download');

  api.setUser({ role: 'support' });
  const supUrl = api.getAttachmentDownloadUrl('dem-123', 'att-456');
  assert.strictEqual(supUrl, 'https://api.importer.conciliadorcontabil.com.br/api/v1/support/tickets/dem-123/attachments/att-456/download');
}

// Test 3: fetchDemandDetails uses developer endpoint for developers
{
  console.log('Test 3: fetchDemandDetails uses developer endpoint for developers');
  const requestedUrls = [];
  const context = {
    window: {},
    fetch: (url, opts) => {
      requestedUrls.push({ url, method: opts?.method || 'GET' });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'dem-999', title: 'Ticket Dev', description: 'Desc do dev' })
      });
    }
  };
  vm.createContext(context);
  vm.runInContext(apiCode, context);
  const api = context.window.conciliadorAPI;

  api.setToken('fake-token');
  api.setUser({ role: 'developer' });

  (async () => {
    const details = await api.fetchDemandDetails('dem-999');
    assert.strictEqual(details.id, 'dem-999');
    assert.strictEqual(details.description, 'Desc do dev');
    assert.strictEqual(requestedUrls.length, 1);
    assert.strictEqual(requestedUrls[0].url, 'https://api.importer.conciliadorcontabil.com.br/api/v1/developer/tickets/dem-999');
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

// Test 4: Automatic fallback when /support/ returns HTTP 403 Forbidden
{
  console.log('Test 4: Automatic fallback when /support/ returns HTTP 403 Forbidden');
  const callHistory = [];
  const context = {
    window: {},
    fetch: (url, opts) => {
      callHistory.push(url);
      if (url.includes('/support/tickets/dem-403')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          statusText: 'Forbidden',
          json: () => Promise.resolve({ message: 'Forbidden resource' })
        });
      }
      if (url.includes('/developer/tickets/dem-403')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ id: 'dem-403', title: 'Recovered Ticket', description: 'Conteudo recuperado via fallback' })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    }
  };
  vm.createContext(context);
  vm.runInContext(apiCode, context);
  const api = context.window.conciliadorAPI;

  api.setToken('dev-token');
  // Suppose user role wasn't explicitly initialized, defaults to 'support'
  api.setUser({ role: 'support' });

  (async () => {
    const details = await api.fetchDemandDetails('dem-403');
    assert.strictEqual(details.id, 'dem-403');
    assert.strictEqual(details.description, 'Conteudo recuperado via fallback');
    // Verifies that /support/ was attempted first and when 403 occurred, fell back to /developer/
    assert.strictEqual(callHistory[0], 'https://api.importer.conciliadorcontabil.com.br/api/v1/support/tickets/dem-403');
    assert.strictEqual(callHistory[1], 'https://api.importer.conciliadorcontabil.com.br/api/v1/developer/tickets/dem-403');
    // Verifies that role was automatically switched to developer to avoid redundant round-trips
    assert.strictEqual(api.getRolePrefix(), 'developer');
    console.log('✅ All ConciliadorAPI Role Scoping tests passed successfully!');
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

