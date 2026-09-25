import { useEffect, useState } from 'react';
import { onValue, ref, update } from 'firebase/database';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { rtdb } from './firebase';
import { seasonPath } from './season';

// Avatars live in their own top-level node rather than inside `league`.
// Every client subscribes to the whole league record, so putting image data
// in there would add hundreds of kilobytes to every launch and every write.
// Here they load separately and only when this hook is mounted.
const AVATARS = 'avatars';

// 160px square at moderate JPEG quality lands around 8-12KB as a data URI —
// small enough to store inline, sharp enough for a 44px circle on a 3x screen.
const SIZE = 160;
const QUALITY = 0.55;

export type AvatarMap = Record<string, string>; // id -> data URI

// A photo belongs to a PERSON, not to a league. It's stored under their id
// alone, so uploading once shows up everywhere they play instead of having to
// be re-added in each league.
//
// Older photos were filed per league as `${leagueKey}_${id}`; those keys are
// still read as a fallback so nothing anybody already uploaded disappears.
export function avatarKey(playerId: string) {
  return playerId;
}

/**
 * The photo to show for `id`.
 *
 * `fallbackIds` covers a shared roster entry: "Scott & Anne" has no photo of
 * its own, so it shows whichever partner has uploaded one.
 */
export function avatarFor(
  map: AvatarMap,
  id: string,
  fallbackIds: string[] = [],
  legacyLeagueKey?: string,
): string | undefined {
  for (const candidate of [id, ...fallbackIds]) {
    if (!candidate) continue;
    if (map[candidate]) return map[candidate];
    // Legacy per-league keys, this league first then any other.
    if (legacyLeagueKey && map[`${legacyLeagueKey}_${candidate}`]) return map[`${legacyLeagueKey}_${candidate}`];
    const legacy = Object.keys(map).find((k) => k.endsWith(`_${candidate}`));
    if (legacy) return map[legacy];
  }
  return undefined;
}

export function useAvatars(): AvatarMap {
  const [map, setMap] = useState<AvatarMap>({});
  useEffect(() => onValue(ref(rtdb, AVATARS), (snap) => setMap(snap.val() || {})), []);
  return map;
}

// Cast photos and the puzzle game's picture live per-league (not per-person
// like avatars) — a league's own upload, only visible in that league. Wider
// than the 160px avatar square since a cast photo shows full-frame on a
// bio's hero image, and the puzzle needs enough detail to survive being cut
// into tiles.
const PHOTO_WIDTH = 400;
const PHOTO_QUALITY = 0.6;
const PUZZLE_WIDTH = 640;
const PUZZLE_QUALITY = 0.65;

async function pickPhoto(width: number, quality: number): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 1 });
  if (picked.canceled || !picked.assets?.length) return null;
  // Resize before encoding: the picker only compresses, so a phone photo
  // would otherwise arrive as a multi-megabyte string. Width only (no
  // height) keeps whatever crop the person picked, since this photo shows
  // up in both circular and rectangular spots around the app.
  const shrunk = await manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width } }],
    { compress: quality, format: SaveFormat.JPEG, base64: true },
  );
  return shrunk.base64 ? `data:image/jpeg;base64,${shrunk.base64}` : null;
}

/** Opens the photo library and stores a castaway's photo for this league only. */
export async function pickAndStoreCastPhoto(leagueKey: string, contestantId: string): Promise<boolean> {
  const uri = await pickPhoto(PHOTO_WIDTH, PHOTO_QUALITY);
  if (!uri) return false;
  await update(ref(rtdb, `${seasonPath()}/leagues/${leagueKey}/castPhotos`), { [contestantId]: uri });
  return true;
}

/** Opens the photo library and stores this league's puzzle-game picture. */
export async function pickAndStorePuzzleImage(leagueKey: string): Promise<boolean> {
  const uri = await pickPhoto(PUZZLE_WIDTH, PUZZLE_QUALITY);
  if (!uri) return false;
  await update(ref(rtdb, `${seasonPath()}/leagues/${leagueKey}`), { puzzleImage: uri });
  return true;
}

export async function setAvatar(playerId: string, dataUri: string | null) {
  // One key per person. Any legacy per-league copies are cleared at the same
  // time so an old photo can't outlive the new one.
  const patch: Record<string, string | null> = { [avatarKey(playerId)]: dataUri };
  await update(ref(rtdb, AVATARS), patch);
}

/**
 * Opens the photo library, squares up the result and stores it.
 * Returns false when the person cancels or declines access.
 */
export async function pickAndStoreAvatar(playerId: string): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return false;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (picked.canceled || !picked.assets?.length) return false;

  // Resize before encoding: the picker only compresses, so a phone photo would
  // otherwise arrive as a multi-megabyte string.
  const shrunk = await manipulateAsync(
    picked.assets[0].uri,
    [{ resize: { width: SIZE, height: SIZE } }],
    { compress: QUALITY, format: SaveFormat.JPEG, base64: true },
  );
  if (!shrunk.base64) return false;

  await setAvatar(playerId, `data:image/jpeg;base64,${shrunk.base64}`);
  return true;
}
