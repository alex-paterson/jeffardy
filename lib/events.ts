import { EventEmitter } from "events";

// Singleton event bus that persists across hot reloads
const globalForEvents = globalThis as unknown as { eventBus: EventEmitter };
export const eventBus = globalForEvents.eventBus ?? new EventEmitter();
globalForEvents.eventBus = eventBus;
eventBus.setMaxListeners(100);
