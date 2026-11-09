/**
 * Robust Streaming Finite State Machine Parser for AI Agent Workspaces
 * Handles streaming chunks across network boundaries, partial XML tags,
 * container tags (<boltArtifact>), whitespace variations, and extracts
 * file creations and commands in real-time.
 */

import { normalizePath } from './vfs';
import { applyPatch, parsePatchBlock } from './patch';

export interface ParsedFile {
  path: string;
  content: string;
  isComplete: boolean;
  isTruncated?: boolean;
}

export interface StreamParserCallbacks {
  onTextMessage?: (delta: string) => void;
  onFileStart?: (path: string) => void;
  onFileContent?: (path: string, content: string, delta: string) => void;
  onFileEnd?: (path: string, totalContent: string) => void;
  onFilePatch?: (path: string, search: string, replace: string, success: boolean, error?: string) => void;
  onCommand?: (command: string) => void;
}

type ParserState = 'TEXT' | 'FILE_CONTENT' | 'COMMAND_CONTENT' | 'PATCH_CONTENT';

export class StreamingActionParser {
  private buffer: string = '';
  private state: ParserState = 'TEXT';
  private currentFilePath: string = '';
  private currentFileContent: string = '';
  private currentCommandContent: string = '';
  private currentPatchContent: string = '';
  private callbacks: StreamParserCallbacks;
  private files: Map<string, ParsedFile> = new Map();

  constructor(
    callbacks: StreamParserCallbacks = {},
    initialFiles?: Map<string, ParsedFile> | Record<string, { path: string; content: string }>
  ) {
    this.callbacks = callbacks;
    if (initialFiles) {
      if (initialFiles instanceof Map) {
        initialFiles.forEach((v, k) => {
          this.files.set(k, { ...v });
        });
      } else {
        for (const [k, v] of Object.entries(initialFiles)) {
          this.files.set(k, { path: v.path || k, content: v.content || '', isComplete: true });
        }
      }
    }
  }

  /**
   * Feed a new raw streaming chunk into the state machine
   */
  public feed(chunk: string): void {
    if (!chunk) return;
    this.buffer += chunk;
    this.processBuffer();
  }

  /**
   * Finalize the stream (flush any remaining content safely)
   */
  public finish(): { files: ParsedFile[]; text: string } {
    if (this.state === 'FILE_CONTENT' && this.currentFilePath) {
      if (this.buffer.length > 0) {
        this.appendCurrentFile(this.buffer);
        this.buffer = '';
      }
      const file = this.files.get(this.currentFilePath);
      if (file) {
        file.isTruncated = true;
      }
      this.closeCurrentFile();
    } else if (this.state === 'COMMAND_CONTENT') {
      if (this.buffer.length > 0) {
        this.currentCommandContent += this.buffer;
        this.buffer = '';
      }
      this.closeCurrentCommand();
    } else if (this.state === 'PATCH_CONTENT' && this.currentFilePath) {
      if (this.buffer.length > 0) {
        this.currentPatchContent += this.buffer;
        this.buffer = '';
      }
      this.closeCurrentPatch();
    } else if (this.buffer.length > 0) {
      // Strip any stray artifact tags before final flush
      const cleanText = this.cleanArtifactTags(this.buffer);
      if (cleanText.length > 0) {
        this.callbacks.onTextMessage?.(cleanText);
      }
      this.buffer = '';
    }

    this.state = 'TEXT';

    return {
      files: Array.from(this.files.values()),
      text: '',
    };
  }

  public getFiles(): Map<string, ParsedFile> {
    return this.files;
  }

  private processBuffer(): void {
    let advanced = true;
    while (advanced && this.buffer.length > 0) {
      advanced = false;

      if (this.state === 'TEXT') {
        // First, check and strip container tags like <boltArtifact ...> or </boltArtifact>
        const artifactMatch = this.buffer.match(/<\/?boltArtifact[^>]*>/i);
        if (artifactMatch && artifactMatch.index !== undefined) {
          const matchIdx = artifactMatch.index;
          if (matchIdx > 0) {
            this.callbacks.onTextMessage?.(this.buffer.substring(0, matchIdx));
          }
          this.buffer = this.buffer.substring(matchIdx + artifactMatch[0].length);
          advanced = true;
          continue;
        }

        // Look for opening action tag: <sandbox_action or <boltAction
        const matchIndex = this.findOpeningTagIndex(this.buffer);

        if (matchIndex === -1) {
          // Check if buffer ends with a potential partial opening tag
          const lastLt = this.buffer.lastIndexOf('<');
          if (lastLt !== -1) {
            const candidate = this.buffer.substring(lastLt);
            if (this.isPotentialOpeningTag(candidate)) {
              const emitText = this.buffer.substring(0, lastLt);
              if (emitText.length > 0) {
                this.callbacks.onTextMessage?.(this.cleanArtifactTags(emitText));
                this.buffer = candidate;
              }
              break; // Wait for more chunks to resolve partial tag
            }
          }

          // No partial tag, emit entire buffer as text
          const cleanText = this.cleanArtifactTags(this.buffer);
          if (cleanText.length > 0) {
            this.callbacks.onTextMessage?.(cleanText);
          }
          this.buffer = '';
          break;
        }

        // Emit text before the opening tag
        if (matchIndex > 0) {
          const textChunk = this.cleanArtifactTags(this.buffer.substring(0, matchIndex));
          if (textChunk.length > 0) {
            this.callbacks.onTextMessage?.(textChunk);
          }
          this.buffer = this.buffer.substring(matchIndex);
        }

        // Check if the complete opening tag header has arrived (ends with '>')
        const tagClose = this.buffer.indexOf('>');
        if (tagClose === -1) {
          // Waiting for more chunks to complete the tag header
          break;
        }

        const tagHeader = this.buffer.substring(0, tagClose + 1);
        this.buffer = this.buffer.substring(tagClose + 1);

        const isSelfClosing = tagHeader.trim().endsWith('/>');
        const actionType = this.extractAttribute(tagHeader, 'type');
        const rawFilePath = this.extractAttribute(tagHeader, 'path') || this.extractAttribute(tagHeader, 'filePath');
        const filePath = rawFilePath ? normalizePath(rawFilePath) : '';

        if (actionType === 'file' && filePath) {
          this.currentFilePath = filePath;
          this.currentFileContent = '';

          const existing = this.files.get(this.currentFilePath);
          if (!existing) {
            this.files.set(this.currentFilePath, {
              path: this.currentFilePath,
              content: '',
              isComplete: isSelfClosing,
            });
          }
          this.callbacks.onFileStart?.(this.currentFilePath);

          if (isSelfClosing) {
            this.closeCurrentFile();
          } else {
            this.state = 'FILE_CONTENT';
          }
          advanced = true;
        } else if (actionType === 'patch' && filePath) {
          this.currentFilePath = filePath;
          this.currentPatchContent = '';
          this.state = 'PATCH_CONTENT';
          advanced = true;
        } else if (actionType === 'command' || actionType === 'shell') {
          if (!isSelfClosing) {
            this.state = 'COMMAND_CONTENT';
            this.currentCommandContent = '';
          }
          advanced = true;
        } else {
          // Unknown action tag, stay in TEXT
          advanced = true;
        }
      } else if (this.state === 'FILE_CONTENT') {
        const openMatchIdx = this.findOpeningTagIndex(this.buffer);
        const closeMatch = this.findClosingTag(this.buffer);

        // Auto-recover if LLM starts a new action without closing previous one
        if (openMatchIdx !== -1 && (closeMatch === null || openMatchIdx < closeMatch.index)) {
          const emitDelta = this.buffer.substring(0, openMatchIdx);
          if (emitDelta.length > 0) {
            this.appendCurrentFile(emitDelta);
          }
          this.closeCurrentFile();
          this.buffer = this.buffer.substring(openMatchIdx);
          this.state = 'TEXT';
          advanced = true;
          continue;
        }

        if (!closeMatch) {
          // Check if buffer ends with a potential partial closing tag (e.g., '</sand' or '</')
          const partialIndex = this.findPartialClosingTagIndex(this.buffer);
          if (partialIndex !== -1) {
            const emitDelta = this.buffer.substring(0, partialIndex);
            if (emitDelta.length > 0) {
              this.appendCurrentFile(emitDelta);
              this.buffer = this.buffer.substring(partialIndex);
            }
          } else {
            this.appendCurrentFile(this.buffer);
            this.buffer = '';
          }
          break;
        }

        // Closing tag found!
        const emitDelta = this.buffer.substring(0, closeMatch.index);
        if (emitDelta.length > 0) {
          this.appendCurrentFile(emitDelta);
        }

        this.buffer = this.buffer.substring(closeMatch.index + closeMatch.length);
        this.closeCurrentFile();
        this.state = 'TEXT';
        advanced = true;
      } else if (this.state === 'COMMAND_CONTENT') {
        const openMatchIdx = this.findOpeningTagIndex(this.buffer);
        const closeMatch = this.findClosingTag(this.buffer);

        if (openMatchIdx !== -1 && (closeMatch === null || openMatchIdx < closeMatch.index)) {
          this.currentCommandContent += this.buffer.substring(0, openMatchIdx);
          this.closeCurrentCommand();
          this.buffer = this.buffer.substring(openMatchIdx);
          this.state = 'TEXT';
          advanced = true;
          continue;
        }

        if (!closeMatch) {
          const partialIndex = this.findPartialClosingTagIndex(this.buffer);
          if (partialIndex !== -1) {
            this.currentCommandContent += this.buffer.substring(0, partialIndex);
            this.buffer = this.buffer.substring(partialIndex);
          } else {
            this.currentCommandContent += this.buffer;
            this.buffer = '';
          }
          break;
        }

        this.currentCommandContent += this.buffer.substring(0, closeMatch.index);
        this.buffer = this.buffer.substring(closeMatch.index + closeMatch.length);
        this.closeCurrentCommand();
        this.state = 'TEXT';
        advanced = true;
      } else if (this.state === 'PATCH_CONTENT') {
        const openMatchIdx = this.findOpeningTagIndex(this.buffer);
        const closeMatch = this.findClosingTag(this.buffer);

        if (openMatchIdx !== -1 && (closeMatch === null || openMatchIdx < closeMatch.index)) {
          this.currentPatchContent += this.buffer.substring(0, openMatchIdx);
          this.closeCurrentPatch();
          this.buffer = this.buffer.substring(openMatchIdx);
          this.state = 'TEXT';
          advanced = true;
          continue;
        }

        if (!closeMatch) {
          const partialIndex = this.findPartialClosingTagIndex(this.buffer);
          if (partialIndex !== -1) {
            this.currentPatchContent += this.buffer.substring(0, partialIndex);
            this.buffer = this.buffer.substring(partialIndex);
          } else {
            this.currentPatchContent += this.buffer;
            this.buffer = '';
          }
          break;
        }

        this.currentPatchContent += this.buffer.substring(0, closeMatch.index);
        this.buffer = this.buffer.substring(closeMatch.index + closeMatch.length);
        this.closeCurrentPatch();
        this.state = 'TEXT';
        advanced = true;
      }
    }
  }

  private appendCurrentFile(delta: string): void {
    if (!delta) return;
    this.currentFileContent += delta;
    const file = this.files.get(this.currentFilePath);
    if (file) {
      file.content = this.currentFileContent;
    }
    this.callbacks.onFileContent?.(this.currentFilePath, this.currentFileContent, delta);
  }

  private closeCurrentFile(): void {
    if (!this.currentFilePath) return;
    const file = this.files.get(this.currentFilePath);
    // Unescape escaped closing tags inside code content (<\\/sandbox_action> -> </sandbox_action>)
    const finalContent = this.currentFileContent.replace(/<\\\/sandbox_action>/gi, '</sandbox_action>');
    if (file) {
      file.isComplete = true;
      file.content = finalContent;
    }
    this.callbacks.onFileEnd?.(this.currentFilePath, finalContent);
    this.currentFilePath = '';
    this.currentFileContent = '';
  }

  private closeCurrentCommand(): void {
    const cmd = this.currentCommandContent.trim();
    if (cmd) {
      this.callbacks.onCommand?.(cmd);
    }
    this.currentCommandContent = '';
  }

  private closeCurrentPatch(): void {
    if (!this.currentFilePath) return;
    const parsed = parsePatchBlock(this.currentPatchContent);
    if (!parsed) {
      this.callbacks.onFilePatch?.(
        this.currentFilePath,
        '',
        '',
        false,
        'Malformed patch: missing <search> or <replace> tags'
      );
      this.currentFilePath = '';
      this.currentPatchContent = '';
      return;
    }

    const file = this.files.get(this.currentFilePath);
    if (!file) {
      const err = `Target file not found in VFS: ${this.currentFilePath}`;
      this.callbacks.onFilePatch?.(this.currentFilePath, parsed.search, parsed.replace, false, err);
      this.callbacks.onTextMessage?.(`\n⚠️ ${err}\n`);
      this.currentFilePath = '';
      this.currentPatchContent = '';
      return;
    }

    const res = applyPatch(file.content, parsed.search, parsed.replace);
    if (res.success) {
      file.content = res.newContent;
      this.callbacks.onFileEnd?.(this.currentFilePath, res.newContent);
      this.callbacks.onFilePatch?.(this.currentFilePath, parsed.search, parsed.replace, true);
    } else {
      this.callbacks.onFilePatch?.(this.currentFilePath, parsed.search, parsed.replace, false, res.error);
      this.callbacks.onTextMessage?.(`\n⚠️ ${res.error}\n`);
    }

    this.currentFilePath = '';
    this.currentPatchContent = '';
  }

  private findOpeningTagIndex(text: string): number {
    const sandboxMatch = text.search(/<sandbox_action\b/i);
    const boltMatch = text.search(/<boltAction\b/i);

    if (sandboxMatch !== -1 && boltMatch !== -1) {
      return Math.min(sandboxMatch, boltMatch);
    }
    return sandboxMatch !== -1 ? sandboxMatch : boltMatch;
  }

  private isPotentialOpeningTag(candidate: string): boolean {
    const lower = candidate.toLowerCase();
    const targets = ['<sandbox_action', '<boltaction', '<boltartifact'];
    return targets.some((t) => t.startsWith(lower) || lower.startsWith(t.substring(0, Math.min(lower.length, 12))));
  }

  private findClosingTag(text: string): { index: number; length: number } | null {
    // Negative lookbehind ensures escaped <\\/sandbox_action> inside code does not close the block
    const match = text.match(/(?<!\\)<\/(sandbox_action|boltAction)\s*>/i);
    if (match && match.index !== undefined) {
      return { index: match.index, length: match[0].length };
    }
    return null;
  }

  private findPartialClosingTagIndex(text: string): number {
    if (text.endsWith('<')) {
      return text.length - 1;
    }
    const lastSlash = text.lastIndexOf('</');
    if (lastSlash === -1) return -1;

    // Check if the slash was escaped with backslash
    if (lastSlash > 0 && text[lastSlash - 1] === '\\') {
      return -1;
    }

    const candidate = text.substring(lastSlash).toLowerCase();
    const closingPrefixes = ['</sandbox_action', '</boltaction'];

    const isMatch = closingPrefixes.some((p) => {
      return p.startsWith(candidate) || candidate.startsWith(p);
    });

    return isMatch ? lastSlash : -1;
  }

  private cleanArtifactTags(text: string): string {
    let clean = text.replace(/<\/?boltArtifact[^>]*>/gi, '');
    // Strip trailing markdown code fence lines (e.g. ```xml) immediately preceding action tag
    clean = clean.replace(/```(?:xml|html|tsx|ts|jsx|js)?\s*$/gi, '');
    // Strip leading markdown code fence line (e.g. ```) immediately following closing action tag
    clean = clean.replace(/^\s*```(?:\n|$)/gi, '');
    return clean;
  }

  private extractAttribute(tag: string, attrName: string): string | null {
    const quotedRegex = new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i');
    const quotedMatch = tag.match(quotedRegex);
    if (quotedMatch) return quotedMatch[1];

    const unquotedRegex = new RegExp(`${attrName}\\s*=\\s*([^\\s>]+)`, 'i');
    const unquotedMatch = tag.match(unquotedRegex);
    return unquotedMatch ? unquotedMatch[1] : null;
  }
}
