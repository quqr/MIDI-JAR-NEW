export function writeMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}
export function writeError(message) {
  process.stderr.write(JSON.stringify({ type: "error", message }) + "\n");
}
//# sourceMappingURL=protocol.js.map
