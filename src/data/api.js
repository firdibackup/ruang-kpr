import { createMockApi } from './mockApi'

// Single switch point for the data adapter (doc 05 §17): swap in an httpApi with the same
// method signatures when the backend exists. Components never import mockApi/mockDb directly.
export const api = createMockApi({ latencyMs: import.meta.env.MODE === 'test' ? 0 : 300 })
