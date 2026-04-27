import { defineStore } from "pinia";
import { ref } from "vue";
import { ServerState } from "@/types";

export const useServerStateStore = defineStore("serverState", () => {
  const state = ref<ServerState>({
    started: false,
    port: null,
    error: null,
    addresses: [],
  });

  async function enable(enabled: boolean): Promise<void> {
    const res = await fetch("/api/server/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) throw new Error("Failed to enable server");
    const newState = await res.json();
    state.value = newState;
  }

  function updateState(newState: ServerState): void {
    state.value = newState;
  }

  async function fetchState(): Promise<void> {
    const res = await fetch("/api/server/state");
    if (!res.ok) throw new Error("Failed to fetch server state");
    const newState = await res.json();
    state.value = newState;
  }

  return {
    state,
    enable,
    updateState,
    fetchState,
  };
});
