/** Keeps a draft attached to its note, and flushes before context changes. */
export class Autosave {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pending: (() => Promise<void>) | undefined;
  private running: Promise<void> = Promise.resolve();
  hasPending(): boolean {
    return Boolean(this.pending);
  }

  schedule(write: () => Promise<void>, onError: (error: unknown) => void) {
    clearTimeout(this.timer);
    this.pending = write;
    this.timer = setTimeout(() => void this.flush().catch(onError), 600);
  }

  async flush(): Promise<void> {
    clearTimeout(this.timer);
    const write = this.pending;
    this.pending = undefined;
    if (!write) return this.running;
    const task = this.running.then(write);
    // Retain a failed draft for an explicit retry; never replay over newer edits.
    this.running = task.catch((error) => {
      if (!this.pending) this.pending = write;
      throw error;
    });
    try {
      await this.running;
    } catch (error) {
      this.running = Promise.resolve();
      throw error;
    }
  }

  discard() {
    clearTimeout(this.timer);
    this.pending = undefined;
  }
}
