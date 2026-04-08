export interface InputLink {
  id: string
  source: string
  url: string
  metadata?: Record<string, any>
}

export interface InputLinkResult {
  success: boolean
  link?: InputLink
  error?: string
}

export class InputLinkHandler {
  private links = new Map<string, InputLink>()

  /** Register a new link */
  register(link: InputLink): InputLinkResult {
    if (this.links.has(link.id)) {
      return { success: false, error: `Link with id "${link.id}" already exists.` }
    }
    this.links.set(link.id, { ...link, metadata: link.metadata ?? {} })
    return { success: true, link }
  }

  /** Retrieve a link by id */
  get(id: string): InputLinkResult {
    const link = this.links.get(id)
    if (!link) {
      return { success: false, error: `No link found for id "${id}".` }
    }
    return { success: true, link }
  }

  /** List all registered links */
  list(): InputLink[] {
    return Array.from(this.links.values())
  }

  /** Remove a link by id */
  unregister(id: string): boolean {
    return this.links.delete(id)
  }

  /** Check if a link exists */
  exists(id: string): boolean {
    return this.links.has(id)
  }

  /** Update metadata for an existing link */
  updateMetadata(id: string, metadata: Record<string, any>): InputLinkResult {
    const link = this.links.get(id)
    if (!link) {
      return { success: false, error: `No link found for id "${id}".` }
    }
    const updated = { ...link, metadata: { ...link.metadata, ...metadata } }
    this.links.set(id, updated)
    return { success: true, link: updated }
  }

  /** Clear all stored links */
  clear(): void {
    this.links.clear()
  }

  /** Count registered links */
  size(): number {
    return this.links.size
  }
}
