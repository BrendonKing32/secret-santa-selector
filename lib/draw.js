export class InputError extends Error {}

const MAX_PARTICIPANTS = 100;
const MAX_NAME_LENGTH = 80;

export function validateDraw(data) {
  if (!data || !Array.isArray(data.names) || !Array.isArray(data.exclusions)) {
    throw new InputError("Provide participants and exclusions.");
  }
  if (data.names.length < 3 || data.names.length > MAX_PARTICIPANTS) {
    throw new InputError("Add between 3 and 100 participants.");
  }
  const names = data.names.map((name) => {
    if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
      throw new InputError("Names must be between 1 and 80 characters.");
    }
    return name.trim();
  });
  if (new Set(names.map((name) => name.toLocaleLowerCase("en-US"))).size !== names.length) {
    throw new InputError("Participant names must be unique, ignoring capitalization.");
  }
  if (data.exclusions.length > (names.length * (names.length - 1)) / 2) {
    throw new InputError("Too many exclusions.");
  }
  const blocked = names.map((_, i) => new Set([i]));
  for (const pair of data.exclusions) {
    if (!Array.isArray(pair) || pair.length !== 2 ||
        !pair.every((i) => Number.isInteger(i) && i >= 0 && i < names.length) ||
        pair[0] === pair[1]) {
      throw new InputError("Each exclusion must name two different participants.");
    }
    blocked[pair[0]].add(pair[1]);
    blocked[pair[1]].add(pair[0]);
  }
  return { names, blocked };
}

function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const value = new Uint32Array(1);
  do {
    crypto.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % max;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Randomized bipartite matching finds a solution whenever one exists.
export function match(blocked) {
  const size = blocked.length;
  const recipients = Array(size).fill(-1);
  const choices = blocked.map((set) => shuffle(Array.from({ length: size }, (_, i) => i)
    .filter((i) => !set.has(i))));
  function assign(giver, seen) {
    for (const recipient of choices[giver]) {
      if (seen.has(recipient)) continue;
      seen.add(recipient);
      if (recipients[recipient] === -1 || assign(recipients[recipient], seen)) {
        recipients[recipient] = giver;
        return true;
      }
    }
    return false;
  }
  for (const giver of shuffle(Array.from({ length: size }, (_, i) => i))) {
    if (!assign(giver, new Set())) return null;
  }
  const result = Array(size);
  recipients.forEach((giver, recipient) => { result[giver] = recipient; });
  return result;
}

export function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
