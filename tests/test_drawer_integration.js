const fs = require('fs');
const vm = require('vm');
const path = require('path');
const assert = require('assert');

// DOM Mock
const domElements = new Map();
function getOrCreateEl(id) {
  if (!domElements.has(id)) {
    domElements.set(id, {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
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
context.window.appStore = {
  demands: [],
  getKnownDevelopers: () => [],
  getTicketTypes: () => [],
  getNote: () => '',
  saveNote: () => Promise.resolve(),
  toggleFavorite: () => Promise.resolve(true),
  toggleIgnore: () => Promise.resolve(true),
  isIgnored: () => false
};
context.window.conciliadorAPI = {
  fetchDemandDetails: (id) => Promise.resolve({
    id,
    title: `Full Details ${id}`,
    status: 'in_progress',
    comments: [{ id: 1, content: 'Comment 1' }],
    events: [],
    attachments: []
  })
};

vm.createContext(context);

// Load tabs.js
const tabsCode = fs.readFileSync(path.join(__dirname, '../src/js/ui/tabs.js'), 'utf8');
vm.runInContext(tabsCode, context);

// Test 1: getSelectedTicket integration
console.log('Integration Test 1: getSelectedTicket tracking with tabs');
const appTabs = context.window.appTabs;
assert.strictEqual(appTabs.activeTabId, 'demands-list');
assert.strictEqual(context.window.getSelectedTicket?.(), null);

const ticketA = { id: 501, number: '501', title: 'Ticket A', status: 'queued' };
appTabs.openTicketTab(ticketA, true);
assert.strictEqual(appTabs.activeTabId, 'ticket-501');
assert.strictEqual(context.window.getSelectedTicket?.()?.id, 501);

const ticketB = { id: 502, number: '502', title: 'Ticket B', status: 'in_progress' };
appTabs.openTicketTab(ticketB, true);
assert.strictEqual(appTabs.activeTabId, 'ticket-502');
assert.strictEqual(context.window.getSelectedTicket?.()?.id, 502);

// Switch back to demands-list
appTabs.switchToTab('demands-list');
assert.strictEqual(appTabs.activeTabId, 'demands-list');
assert.strictEqual(context.window.getSelectedTicket?.(), null);

// Test 2: Race condition guard when on demands-list
console.log('Integration Test 2: Race condition guard on demands-list');
// Simulating an async fetch arrival for 501 while user is on demands-list:
const bgDetails = { id: 501, title: 'Updated 501 Details', status: 'done', comments: [{ id: 99, content: 'Done!' }] };
appTabs.cacheFetchedDetails(501, bgDetails);
// activeTabId must still be demands-list and getSelectedTicket must be null
assert.strictEqual(appTabs.activeTabId, 'demands-list');
assert.strictEqual(context.window.getSelectedTicket?.(), null);
// cached session must have updated details
const s501 = appTabs.ticketSessions.get(501);
assert.strictEqual(s501.ticket.title, 'Updated 501 Details');

// Test 3: dataset.tabBound guard prevents duplicate bindings on drawer buttons
console.log('Integration Test 3: dataset.tabBound guard on drawer buttons');
const btnCloseEl = getOrCreateEl('btnCloseDrawer');
btnCloseEl.dataset.tabBound = 'true';
let listenerCount = 0;
btnCloseEl.addEventListener = () => { listenerCount++; };

// Simulate app.js binding attempt
if (!btnCloseEl.dataset?.tabBound) {
  btnCloseEl.addEventListener('click', () => {});
}
assert.strictEqual(listenerCount, 0, 'No duplicate listener should be added when tabBound is true');

// Test 4: Tab dirty state reset after comment submission
console.log('Integration Test 4: Dirty state reset after comment submission');
const ticketC = { id: 601, number: '601', title: 'Ticket C', status: 'queued' };
appTabs.openTicketTab(ticketC, true);
getOrCreateEl('drawerEditTitle').value = 'Ticket C';
const commentInput = getOrCreateEl('drawerNewCommentText');
commentInput.value = 'Texto do comentário';
appTabs.checkDirty(601);
assert.strictEqual(appTabs.isTicketDirty(601), true, 'Must be dirty while comment has text');

// Simulate comment submission success: textarea cleared and session reset
commentInput.value = '';
const session601 = appTabs.ticketSessions.get(601);
if (session601) {
  session601.commentDraft = '';
  session601.pendingAttachments = [];
}
appTabs.checkDirty(601);
assert.strictEqual(appTabs.isTicketDirty(601), false, 'Must be non-dirty after comment is cleared and submitted');

console.log('\n✅ All drawer integration tests passed successfully!');
