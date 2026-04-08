export interface MetricEntry {
  key: string
  value: number
  updatedAt: number
}

export class MetricsCache {
  private cache = new Map<string, MetricEntry>()

  /** Retrieve a metric entry by key */
  get(key: string): MetricEntry | undefined {
    return this.cache.get(key)
  }

  /** Set or update a metric entry */
  set(key: string, value: number): void {
    this.cache.set(key, { key, value, updatedAt: Date.now() })
  }

  /** Check if a metric entry exists and is recent within maxAgeMs */
  hasRecent(key: string, maxAgeMs: number): boolean {
    const entry = this.cache.get(key)
    return !!entry && Date.now() - entry.updatedAt < maxAgeMs
  }

  /** Remove a specific entry */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /** Clear all entries */
  clear(): void {
    this.cache.clear()
  }

  /** List all metric entries */
  entries(): MetricEntry[] {
    return Array.from(this.cache.values())
  }

  /** Get total number of entries */
  size(): number {
    return this.cache.size
  }

  /** Return all keys */
  keys(): string[] {
    return Array.from(this.cache.keys())
  }

  /** Return all values */
  values(): number[] {
    return Array.from(this.cache.values()).map(e => e.value)
  }

  /** Remove expired entries older than maxAgeMs */
  prune(maxAgeMs: number): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.updatedAt > maxAgeMs) {
        this.cache.delete(key)
      }
    }
  }

  /** Update entry if exists, otherwise ignore */
  updateIfExists(key: string, value: number): void {
    const entry = this.cache.get(key)
    if (entry) {
      this.cache.set(key, { key, value, updatedAt: Date.now() })
    }
  }
}
