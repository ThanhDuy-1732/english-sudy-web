import { get, set, del } from "idb-keyval";

const INDEX_KEY = "__audioIndex";
const MAX = 20;

async function getIndex(): Promise<string[]> {
  return (await get<string[]>(INDEX_KEY)) ?? [];
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  await set(`audio:${id}`, blob);
  const index = await getIndex();
  const next = [id, ...index.filter((x) => x !== id)];
  for (const old of next.slice(MAX)) await del(`audio:${old}`);
  await set(INDEX_KEY, next.slice(0, MAX));
}

export function loadAudio(id: string): Promise<Blob | undefined> {
  return get<Blob>(`audio:${id}`);
}

export async function clearAllAudio(): Promise<void> {
  const index = await getIndex();
  await Promise.all(index.map((id) => del(`audio:${id}`)));
  await set(INDEX_KEY, []);
}

export async function getAudioCount(): Promise<number> {
  return (await getIndex()).length;
}
