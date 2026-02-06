import { TextDocument } from "vscode-languageserver-textdocument";
import { Position } from "vscode-languageserver";
import { FunctionCallContext } from "../types";

/**
 * Parse PHP/Blade documents to detect the current function call context
 * at a given cursor position. Used to determine which completion provider
 * should respond.
 *
 * This is a regex-based parser for Phase 1. In later phases, we can
 * integrate the PHP Parser Binary for more accurate AST-based analysis.
 */
export class ContextParser {
  // Pattern to match common Laravel function calls
  // Matches: functionName('prefix, Class::method('prefix, $this->method('prefix
  private static readonly FUNCTION_PATTERNS: Array<{
    pattern: RegExp;
    extractFn: (match: RegExpMatchArray) => { functionName: string; className?: string };
  }> = [
    // Static method: Route::has('name'), Config::get('key')
    {
      pattern: /(\w+)::(\w+)\s*\(\s*(?:['"])([^'"]*)$/,
      extractFn: (m) => ({ className: m[1], functionName: m[2] }),
    },
    // Global function: route('name'), view('name'), config('key')
    {
      pattern: /(?<![:\w])(\w+)\s*\(\s*(?:['"])([^'"]*)$/,
      extractFn: (m) => ({ functionName: m[1] }),
    },
    // Method chain: $this->redirect()->route('name')
    {
      pattern: /->(\w+)\s*\(\s*(?:['"])([^'"]*)$/,
      extractFn: (m) => ({ functionName: m[1] }),
    },
    // Blade directive: @route('name'), @lang('key')
    {
      pattern: /@(\w+)\s*\(\s*(?:['"])([^'"]*)$/,
      extractFn: (m) => ({ functionName: m[1] }),
    },
  ];

  /**
   * Get the function call context at the given position.
   * Returns null if the cursor is not inside a recognized function call string argument.
   */
  getContext(
    document: TextDocument,
    position: Position
  ): FunctionCallContext | null {
    // Get text from the start of the line to the cursor position
    const lineText = document.getText({
      start: { line: position.line, character: 0 },
      end: position,
    });

    for (const { pattern, extractFn } of ContextParser.FUNCTION_PATTERNS) {
      const match = lineText.match(pattern);
      if (!match) continue;

      const { functionName, className } = extractFn(match);

      // Extract the prefix (what the user has typed so far inside the string)
      const prefix = match[match.length - 1] || "";

      // Calculate the range of the prefix in the document
      const prefixStart = lineText.length - prefix.length;

      return {
        functionName,
        className,
        parameterIndex: 0,
        prefix,
        fullMatch: match[0],
        range: {
          start: { line: position.line, character: prefixStart },
          end: { line: position.line, character: position.character },
        },
      };
    }

    return null;
  }

  /**
   * Get the full string value at a position (for go-to-definition).
   * Extracts the complete string content between quotes.
   */
  getStringAtPosition(
    document: TextDocument,
    position: Position
  ): FunctionCallContext | null {
    const line = document.getText({
      start: { line: position.line, character: 0 },
      end: { line: position.line, character: Number.MAX_SAFE_INTEGER },
    });

    // Find the string that contains the cursor
    const cursorOffset = position.character;

    // Check both single and double quotes
    for (const quote of ["'", '"']) {
      let start = -1;
      let end = -1;

      // Find the opening quote before cursor
      for (let i = cursorOffset - 1; i >= 0; i--) {
        if (line[i] === quote) {
          start = i + 1;
          break;
        }
      }

      if (start === -1) continue;

      // Find the closing quote after cursor
      for (let i = cursorOffset; i < line.length; i++) {
        if (line[i] === quote) {
          end = i;
          break;
        }
      }

      if (end === -1) continue;

      const fullString = line.substring(start, end);

      // Now check what function this string belongs to
      const context = this.getContext(document, {
        line: position.line,
        character: start,
      });

      if (context) {
        return {
          ...context,
          prefix: fullString,
        };
      }
    }

    return null;
  }
}
