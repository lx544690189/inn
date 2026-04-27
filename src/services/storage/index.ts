import { DexieIndexedDbAdapter } from './dexie-indexed-db-adapter'

export { DexieIndexedDbAdapter }
export type * from '../../types/storage'

export const createStorageAdapter = () => new DexieIndexedDbAdapter()
