/**
 * Shared formatting helpers for building AI prompt content.
 */

/**
 * Build a fenced code block that won't break even if `content` contains backtick runs.
 * The fence length is always at least 3, and always longer than any backtick run inside the content.
 * This follows the CommonMark spec for dynamic fence length.
 *
 * @param {string} filePath - Display label shown as the heading above the code block.
 * @param {string} content  - Raw source content to embed inside the fence.
 * @returns {string} Markdown snippet: heading + fenced code block.
 */
export function buildFencedSnippet(filePath, content) {
    const longestRun = Math.max(0, ...([...content.matchAll(/`+/g)].map(m => m[0].length)));
    const fence = '`'.repeat(Math.max(3, longestRun + 1));
    return `### ${filePath}\n${fence}\n${content}\n${fence}`;
}
