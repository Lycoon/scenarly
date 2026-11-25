/** Stands in for the `cloudflare:workers` runtime module, which only exists in a Worker. */
export class DurableObject {
    constructor(
        public ctx: unknown,
        public env: unknown,
    ) {}
}
