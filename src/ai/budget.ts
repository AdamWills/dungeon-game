// The run's AI spending: every call is priced from the usage the API reports
// and counted here. A call the remaining budget cannot cover is never made.

export class Budget {
  spent = 0;
  calls = 0;

  constructor(public limit: number) {}

  get left(): number {
    return Math.max(0, this.limit - this.spent);
  }

  /** Can we afford a call that might cost up to this much? */
  canAfford(worstCase: number): boolean {
    return this.spent + worstCase <= this.limit;
  }

  charge(cost: number): void {
    this.spent += Math.max(0, cost);
    this.calls++;
  }

  reset(limit = this.limit): void {
    this.limit = limit;
    this.spent = 0;
    this.calls = 0;
  }
}

/** "$0.04" for the meter; tiny amounts show as "<$0.01". */
export function formatUsd(n: number): string {
  if (n > 0 && n < 0.01) return '<$0.01';
  return `$${n.toFixed(2)}`;
}
