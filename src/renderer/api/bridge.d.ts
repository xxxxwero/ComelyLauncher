interface ComelyBridge {
  invoke(channel: string, args: unknown[]): Promise<unknown>;
  on(name: string, listener: (payload: unknown) => void): () => void;
}

interface Window {
  comely: ComelyBridge;
}
