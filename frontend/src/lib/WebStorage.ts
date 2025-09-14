export class WebStorage {
  storage: Storage

  constructor(isSession: boolean = false) {
    this.storage = isSession ? window?.sessionStorage : window?.localStorage
  }

  isReady() {
    return !!this.storage
  }

  set(key: string, value: string) {
    this.storage?.setItem(key, value)
  }

  get(key: string) {
    return this.storage?.getItem(key)
  }

  remove(key: string) {
    this.storage.removeItem(key)
  }

  has(key: string) {
    const value = LocalStorage.get(key)
    return value !== undefined && value !== null
  }
}

export const LocalStorage = new WebStorage()
export const SessionStorage = new WebStorage(true)
