// Standalone test script for TabManager logic
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// Create mock environment
const domElements = new Map();
function getOrCreateEl(id) {
  if (!domElements.has(id)) {
    domElements.set(id, {
      id,
      value: '',
      dataset: {},
      style: {
        setProperty: () => {},
        display: ''
      },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); },
        toggle(c, force) {
          if (force !== undefined) {
            if (force) this.add(c); else this.remove(c);
          } else {
            if (this.contains(c)) this.remove(c); else this.add(c);
          }
        }
      },
      addEventListener: () => {},
      scrollBy: () => {},
      scrollIntoView: () => {},
      cloneNode() { return getOrCreateEl(id + '_clone'); },
      parentNode: {
        replaceChild: () => {}
      },
      querySelectorAll: () => [],
      querySelector: () => null
    });
  }
  return domElements.get(id);
}

const mockStorage = new Map();
const mockLocalStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k)
};

const context = {
  console,
  setTimeout,
  clearTimeout,
  requestAnimationFrame: (cb) => cb(),
  document: {
    readyState: 'complete',
    getElementById: (id) => getOrCreateEl(id),
    querySelector: (sel) => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    body: getOrCreateEl('body')
  },
  localStorage: mockLocalStorage,
  window: {
    addEventListener: () => {},
    removeEventListener: () => {}
  }
};
context.window.document = context.document;

// Load tabs.js into context
const tabsCode = fs.readFileSync(path.join(__dirname, '../src/js/ui/tabs.js'), 'utf8');
vm.createContext(context);
vm.runInContext(tabsCode, context);

const appTabs = context.window.appTabs;
assert(appTabs, 'appTabs should be instantiated');

// 1. Verify initial state
console.log('Test 1: Initial state');
assert.strictEqual(appTabs.tabs.length, 1);
assert.strictEqual(appTabs.tabs[0].id, 'demands-list');
assert.strictEqual(appTabs.tabs[0].isPinned, true);
assert.strictEqual(appTabs.activeTabId, 'demands-list');

// 2. Open Ticket Tab
console.log('Test 2: Open ticket tab');
const ticket1 = { id: 6391, number: '6391', title: 'Erro de Conciliação BB', status: 'in_progress' };
const tab1 = appTabs.openTicketTab(ticket1, true);
assert(tab1, 'tab should be returned');
assert.strictEqual(appTabs.tabs.length, 2);
assert.strictEqual(appTabs.activeTabId, 'ticket-6391');
assert.strictEqual(appTabs.getActiveTicketId(), 6391);
assert(context.document.body.classList.contains('ticket-workspace-active'), 'body should have ticket-workspace-active');

// 3. Open Second Ticket Tab
console.log('Test 3: Open second ticket tab');
const ticket2 = { id: 10405, number: '10405', title: 'Extrato Itaú Falhando', status: 'queued' };
const tab2 = appTabs.openTicketTab(ticket2, true);
assert.strictEqual(appTabs.tabs.length, 3);
assert.strictEqual(appTabs.activeTabId, 'ticket-10405');
assert.strictEqual(appTabs.getActiveTicketId(), 10405);

// 4. Tab cycling (Ctrl+Tab)
console.log('Test 4: Tab cycling');
appTabs.cycleTab(1); // from 10405 (index 2) -> (index 0) 'demands-list'
assert.strictEqual(appTabs.activeTabId, 'demands-list');
assert(!context.document.body.classList.contains('ticket-workspace-active'), 'body should NOT have ticket-workspace-active');

appTabs.cycleTab(1); // from 'demands-list' (index 0) -> (index 1) 'ticket-6391'
assert.strictEqual(appTabs.activeTabId, 'ticket-6391');
assert(context.document.body.classList.contains('ticket-workspace-active'), 'body should have ticket-workspace-active');

// 5. Cannot close pinned tab
console.log('Test 5: Pinned tab close protection');
(async () => {
  const closedPinned = await appTabs.closeTab('demands-list');
  assert.strictEqual(closedPinned, false);
  assert.strictEqual(appTabs.tabs.length, 3);

  // 6. Close non-dirty ticket tab
  console.log('Test 6: Close non-dirty ticket tab');
  const closedTab = await appTabs.closeTab('ticket-6391');
  assert.strictEqual(closedTab, true);
  assert.strictEqual(appTabs.tabs.length, 2);

  // 7. Dirty tab protection
  console.log('Test 7: Dirty tab protection');
  appTabs.markDirty(10405, true);
  assert.strictEqual(appTabs.tabs.find(t => t.ticketId === 10405).isDirty, true);

  // When user rejects confirmation:
  context.window.showAppConfirm = () => Promise.resolve(false);
  const rejectClose = await appTabs.closeTab('ticket-10405');
  assert.strictEqual(rejectClose, false);
  assert.strictEqual(appTabs.tabs.length, 2);

  // When user accepts confirmation:
  context.window.showAppConfirm = () => Promise.resolve(true);
  const acceptClose = await appTabs.closeTab('ticket-10405');
  assert.strictEqual(acceptClose, true);
  assert.strictEqual(appTabs.tabs.length, 1);
  assert.strictEqual(appTabs.activeTabId, 'demands-list');

  // 8. Race condition caching test
  console.log('Test 8: Concurrent fetch caching');
  appTabs.openTicketTab(ticket1, true); // Active is 6391
  appTabs.openTicketTab(ticket2, true); // Active is now 10405

  // Background fetch for 6391 returns now
  const bgDetails = { id: 6391, title: 'Título Atualizado do 6391', status: 'done', comments: [{ id: 1, content: 'msg' }] };
  appTabs.cacheFetchedDetails(6391, bgDetails);

  // Active tab must still be 10405 and undisturbed
  assert.strictEqual(appTabs.activeTabId, 'ticket-10405');
  assert.strictEqual(appTabs.getActiveTicketId(), 10405);

  // Cached session for 6391 must contain the fresh data
  const s6391 = appTabs.ticketSessions.get(6391);
  assert(s6391, 'session should exist');
  assert.strictEqual(s6391.ticket.title, 'Título Atualizado do 6391');
  assert.strictEqual(s6391.ticket.status, 'done');

  // Tab metadata for 6391 must be updated
  const tab6391 = appTabs.tabs.find(t => t.ticketId === 6391);
  assert.strictEqual(tab6391.status, 'done');

  // 9. Persistence test
  console.log('Test 9: Persistence save and restore');
  appTabs.persistOpenTabs();
  const rawSaved = mockStorage.get(appTabs.STORAGE_KEY);
  assert(rawSaved, 'tabs should be stored in localStorage');
  const parsed = JSON.parse(rawSaved);
  assert(parsed.ticketIds.includes(6391));
  assert(parsed.ticketIds.includes(10405));
  assert.strictEqual(parsed.activeTabId, 'ticket-10405');

  // Test restoration into a clean TabManager instance
  const freshTabManager = new context.window.appTabs.constructor();
  context.window.appStore = {
    demands: [
      { id: 6391, number: '6391', title: 'Chamado 6391', status: 'done' },
      { id: 10405, number: '10405', title: 'Chamado 10405', status: 'queued' }
    ]
  };
  freshTabManager.restorePersistedTabs();
  assert.strictEqual(freshTabManager.tabs.length, 3);
  assert(freshTabManager.tabs.some(t => t.ticketId === 6391));
  assert(freshTabManager.tabs.some(t => t.ticketId === 10405));
  assert.strictEqual(freshTabManager.activeTabId, 'ticket-10405');

  // 10. Scroll snapshot and restore
  console.log('Test 10: Scroll snapshot and restoration');
  const tvEl = getOrCreateEl('tableViewContainer');
  const kvEl = getOrCreateEl('kanbanViewContainer');
  const cbEl = getOrCreateEl('contentBody');
  tvEl.scrollTop = 350;
  tvEl.scrollLeft = 50;
  kvEl.scrollTop = 120;
  kvEl.scrollLeft = 200;
  cbEl.scrollTop = 80;

  appTabs.saveListScrollSnapshot();
  assert.strictEqual(appTabs.listScrollSnapshot.tableTop, 350);
  assert.strictEqual(appTabs.listScrollSnapshot.tableLeft, 50);
  assert.strictEqual(appTabs.listScrollSnapshot.kanbanTop, 120);

  // Clear scroll values as if Blink reset them on display: none
  tvEl.scrollTop = 0;
  tvEl.scrollLeft = 0;
  kvEl.scrollTop = 0;

  appTabs.restoreListScrollSnapshot();
  assert.strictEqual(tvEl.scrollTop, 350);
  assert.strictEqual(tvEl.scrollLeft, 50);
  assert.strictEqual(kvEl.scrollTop, 120);

  // 11. Session Draft Preservation
  console.log('Test 11: Session draft and attachments preservation');
  context.window.openDemandDrawer = () => {};
  const commentBox = getOrCreateEl('drawerNewCommentText');

  // Currently on ticket-10405: user types draft and attaches file
  await appTabs.switchToTab('ticket-10405');
  commentBox.value = 'Rascunho de comentário no 10405';
  let fakeAttachments = [{ name: 'print_erro.png', size: 1024 }];
  context.window.getTimelinePendingAttachments = () => fakeAttachments;
  context.window.setTimelinePendingAttachments = (arr) => { fakeAttachments = arr; };

  // Switch to ticket-6391 (switchToTab auto-saves 10405 session)
  await appTabs.switchToTab('ticket-6391');
  assert.strictEqual(appTabs.activeTabId, 'ticket-6391');

  // On ticket-6391: user types another comment
  commentBox.value = 'Outro rascunho no 6391';
  fakeAttachments = [{ name: 'planilha.xlsx', size: 2048 }];

  // Switch back to 10405: must restore 10405's draft and print_erro.png!
  await appTabs.switchToTab('ticket-10405');
  assert.strictEqual(commentBox.value, 'Rascunho de comentário no 10405');
  assert.strictEqual(fakeAttachments.length, 1);
  assert.strictEqual(fakeAttachments[0].name, 'print_erro.png');

  // Switch back to 6391: must restore 6391's draft and planilha.xlsx!
  await appTabs.switchToTab('ticket-6391');
  assert.strictEqual(commentBox.value, 'Outro rascunho no 6391');
  assert.strictEqual(fakeAttachments.length, 1);
  assert.strictEqual(fakeAttachments[0].name, 'planilha.xlsx');

  // 12. Title cleaning with layout codes
  console.log('Test 12: Title cleaning with layout code');
  const cleaned1 = appTabs.formatTabTitle('5190 - Erro de Importação', '5190');
  assert.strictEqual(cleaned1, '5190 – Erro de Importação');

  const cleaned2 = appTabs.formatTabTitle('5190', '5190');
  assert.strictEqual(cleaned2, '5190');

  const cleaned3 = appTabs.formatTabTitle('Ajuste de Saldo Santander', null);
  assert.strictEqual(cleaned3, 'Ajuste de Saldo Santander');

  // 13. Background tab dirty check with formOverrides
  console.log('Test 13: Background tab dirty check with formOverrides');
  const s10405 = appTabs.ticketSessions.get(10405);
  assert(s10405, 'session 10405 should exist');
  s10405.formOverrides = { title: 'Título Modificado Pendente de Salvar' };
  // Tab 10405 is currently in background (active is 6391)
  assert.strictEqual(appTabs.isTicketDirty(10405), true, 'Background tab with modified formOverrides must be recognized as dirty');

  // 14. Active tab description editing dirty check
  console.log('Test 14: Active tab description editing dirty check');
  context.window.isDrawerEditingDesc = () => true;
  const descEditorEl = getOrCreateEl('drawerEditDescEditor');
  descEditorEl.innerHTML = '<p>Nova descrição longa ainda não salva</p>';
  const s6391_tab = appTabs.tabs.find(t => t.ticketId === 6391);
  s6391_tab.ticket.description = '<p>Descrição original antiga</p>';
  assert.strictEqual(appTabs.checkDirty(6391), true, 'Active tab with modified description editor must be recognized as dirty');

  // 15. Concurrent background fetch when active is demands-list
  console.log('Test 15: Concurrent background fetch when active tab is demands-list');
  await appTabs.switchToTab('demands-list');
  assert.strictEqual(appTabs.activeTabId, 'demands-list');
  assert.strictEqual(appTabs.getActiveTicketId(), null);

  // Background fetch completes for 10405 while user is on demands-list
  const asyncBgDetails = { id: 10405, title: 'Título 10405 Atualizado via API', status: 'in_progress' };
  appTabs.cacheFetchedDetails(10405, asyncBgDetails);
  assert.strictEqual(appTabs.activeTabId, 'demands-list');
  assert.strictEqual(appTabs.getActiveTicketId(), null);
  const cachedS10405 = appTabs.ticketSessions.get(10405);
  assert.strictEqual(cachedS10405.ticket.title, 'Título 10405 Atualizado via API');
  const tabMeta10405 = appTabs.tabs.find(t => t.ticketId === 10405);
  assert.strictEqual(tabMeta10405.status, 'in_progress');

  // 16. Persistence restore idempotency and syncWithStoreDemands
  console.log('Test 16: Idempotent restorePersistedTabs and syncWithStoreDemands');
  const initialTabCount = freshTabManager.tabs.length;
  // Calling restorePersistedTabs a second time should do nothing
  freshTabManager.restorePersistedTabs();
  assert.strictEqual(freshTabManager.tabs.length, initialTabCount, 'Second call to restorePersistedTabs must be a no-op');

  // Update store with fresh status
  context.window.appStore.demands[0].status = 'review';
  context.window.appStore.demands[0].title = 'Novo Título 6391';
  freshTabManager.syncWithStoreDemands();
  const synchedTab = freshTabManager.tabs.find(t => t.ticketId === 6391);
  assert.strictEqual(synchedTab.status, 'review');
  assert(synchedTab.title.includes('Novo Título 6391'));

  // 17. Number prefix sanitization
  console.log('Test 17: Tab number sanitization');
  const tWithPound = { id: 7777, number: '#7777', title: 'Chamado com cerquilha' };
  const tabPound = appTabs.openTicketTab(tWithPound, false);
  assert.strictEqual(tabPound.number, '#7777');
  // Subsequent updates must never duplicate into ##7777 or ###7777
  appTabs.updateTab(7777, { number: tabPound.number });
  assert.strictEqual(tabPound.number, '#7777');
  appTabs.updateTab(7777, { number: '###7777' });
  assert.strictEqual(tabPound.number, '#7777');

  console.log('\n✅ All 17 TabManager unit tests passed successfully!');
})().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

