// fake-indexeddb: dev-only dependency so the encrypted Dexie repository can be
// tested in node. Zero impact on the shipped bundle (spec §1 budget applies to
// runtime dependencies only).
import 'fake-indexeddb/auto'
