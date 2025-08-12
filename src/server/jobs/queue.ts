// src/server/jobs/queue.ts
export interface JobQueue<TJob, TResult> {
  enqueue(job: TJob): Promise<TResult>;
  enqueueOnly?(job: TJob): Promise<{ jobId: string }>;
  getQueueStats?(): Promise<{
    pending: number;
    active: number;
    completed: number;
    failed: number;
  }>;
}

interface PendingJob<TJob, TResult> {
  job: TJob;
  resolve: (value: TResult | PromiseLike<TResult>) => void;
  reject: (reason?: unknown) => void;
}

export class InMemoryQueue<TJob, TResult> implements JobQueue<TJob, TResult> {
  private readonly concurrency: number;
  private readonly handler: (job: TJob) => Promise<TResult>;
  private readonly queue: Array<PendingJob<TJob, TResult>> = [];
  private active = 0;

  constructor(options: { concurrency: number; handler: (job: TJob) => Promise<TResult> }) {
    this.concurrency = Math.max(1, options.concurrency);
    this.handler = options.handler;
  }

  enqueue(job: TJob): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      this.queue.push({ job, resolve, reject });
      this.runNext();
    });
  }

  private runNext(): void {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) return;
      this.active += 1;
      this.handler(next.job)
        .then((result) => next.resolve(result))
        .catch((err: unknown) => next.reject(err))
        .finally(() => {
          this.active -= 1;
          // Schedule to avoid deep recursion
          setImmediate(() => this.runNext());
        });
    }
  }
}


