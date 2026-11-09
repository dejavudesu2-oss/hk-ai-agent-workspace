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

  // 1. Direct exact match attempt
  let count = 0;
  let pos = 0;
  while ((pos = originalContent.indexOf(searchText, pos)) !== -1) {
    count++;
    pos += searchText.length;
  }

  if (count === 1) {
    const matchIdx = originalContent.indexOf(searchText);
    const newContent =
      originalContent.substring(0, matchIdx) +
      replaceText +
      originalContent.substring(matchIdx + searchText.length);
    return { success: true, newContent, matchCount: 1 };
  }

  // 2. If 0 matches, attempt line-ending normalization (handle CRLF vs LF)
  if (count === 0) {
    const normOriginal = originalContent.replace(/\r\n/g, '\n');
    const normSearch = searchText.replace(/\r\n/g, '\n');
    const normReplace = replaceText.replace(/\r\n/g, '\n');

    let normCount = 0;
    let normPos = 0;
    while ((normPos = normOriginal.indexOf(normSearch, normPos)) !== -1) {
      normCount++;
      normPos += normSearch.length;
    }

    if (normCount === 1) {
      const matchIdx = normOriginal.indexOf(normSearch);
      const newContent =
        normOriginal.substring(0, matchIdx) +
        normReplace +
        normOriginal.substring(matchIdx + normSearch.length);
      const finalContent = originalContent.includes('\r\n')
        ? newContent.replace(/\n/g, '\r\n')
        : newContent;
      return { success: true, newContent: finalContent, matchCount: 1 };
    }

    // 3. If still 0 matches, check if leading/trailing single newline from XML block was included
    if (normSearch.startsWith('\n') && normSearch.endsWith('\n')) {
      const trimmedSearch = normSearch.slice(1, -1);
      const trimmedReplace =
        normReplace.startsWith('\n') && normReplace.endsWith('\n')
          ? normReplace.slice(1, -1)
          : normReplace;

      let trimCount = 0;
      let trimPos = 0;
      while ((trimPos = normOriginal.indexOf(trimmedSearch, trimPos)) !== -1) {
        trimCount++;
        trimPos += trimmedSearch.length;
      }

      if (trimCount === 1) {
        const matchIdx = normOriginal.indexOf(trimmedSearch);
        const newContent =
          normOriginal.substring(0, matchIdx) +
          trimmedReplace +
          normOriginal.substring(matchIdx + trimmedSearch.length);
        const finalContent = originalContent.includes('\r\n')
          ? newContent.replace(/\n/g, '\r\n')
          : newContent;
        return { success: true, newContent: finalContent, matchCount: 1 };
      }
    }
  }

  if (count === 0) {
    return {
      success: false,
      newContent: originalContent,
      error: `Patch rejected: search text not found in target file. (Expected 1 match, found 0).`,
      matchCount: 0,
    };
  }

  return {
    success: false,
    newContent: originalContent,
    error: `Patch rejected: search text is ambiguous. (Expected 1 match, found ${count}).`,
    matchCount: count,
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
