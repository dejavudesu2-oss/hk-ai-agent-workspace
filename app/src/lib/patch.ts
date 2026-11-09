/**
 * app/src/lib/patch.ts
 * Search & Replace Patch Engine for Edit Turns.
 * Enforces strict single-match invariant: rejects patches matching 0 or >1 times.
 */

export interface PatchResult {
  success: boolean;
  newContent: string;
  error?: string;
  matchCount: number;
}

/**
 * Applies a search/replace patch to the target file content.
 * Fails and rejects if searchText does not match EXACTLY once.
 */
export function applyPatch(
  originalContent: string,
  searchText: string,
  replaceText: string
): PatchResult {
  if (typeof searchText !== 'string' || searchText.length === 0) {
    return {
      success: false,
      newContent: originalContent,
      error: 'Patch rejected: search text cannot be empty.',
      matchCount: 0,
    };
  }

  // Count occurrences of searchText in originalContent
  let count = 0;
  let pos = 0;
  while ((pos = originalContent.indexOf(searchText, pos)) !== -1) {
    count++;
    pos += searchText.length;
  }

  if (count === 0) {
    return {
      success: false,
      newContent: originalContent,
      error: `Patch rejected: search text not found in target file. (Expected 1 match, found 0).`,
      matchCount: 0,
    };
  }

  if (count > 1) {
    return {
      success: false,
      newContent: originalContent,
      error: `Patch rejected: search text is ambiguous. (Expected 1 match, found ${count}).`,
      matchCount: count,
    };
  }

  // Exact 1 match: replace safely
  const matchIdx = originalContent.indexOf(searchText);
  const newContent =
    originalContent.substring(0, matchIdx) +
    replaceText +
    originalContent.substring(matchIdx + searchText.length);

  return {
    success: true,
    newContent,
    matchCount: 1,
  };
}

/**
 * Extracts <search>...</search> and <replace>...</replace> from a patch action block
 */
export function parsePatchBlock(blockText: string): { search: string; replace: string } | null {
  const searchMatch = blockText.match(/<search>([\s\S]*?)<\/search>/i);
  const replaceMatch = blockText.match(/<replace>([\s\S]*?)<\/replace>/i);

  if (!searchMatch || !replaceMatch) {
    return null;
  }

  return {
    search: searchMatch[1],
    replace: replaceMatch[1],
  };
}
