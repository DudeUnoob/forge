/**
 * Lightweight AST parser for JavaScript/TypeScript and Python files.
 * Uses regex-based parsing for Lambda compatibility (no native modules needed).
 * Extracts: modules, classes, functions, imports, and dependency edges.
 */

// File extensions we support parsing
const SUPPORTED_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
    '.py',
]);

const IGNORE_DIRS = new Set([
    'node_modules', '.git', '__pycache__', '.next', 'dist', 'build',
    '.vscode', '.idea', 'coverage', '.nyc_output', 'venv', '.venv',
    '.tox', 'egg-info',
]);

/**
 * Parse a collection of files into a module graph.
 * @param {Array<{path: string, content: string}>} files
 * @returns {{ modules: object[], edges: object[], stats: object }}
 */
export function parseFiles(files) {
    const modules = [];
    const edges = [];
    const fileIndex = {};

    // Filter to supported files
    const parseable = files.filter(f => {
        const ext = getExtension(f.path);
        const dir = f.path.split('/');
        const hasIgnoredDir = dir.some(d => IGNORE_DIRS.has(d));
        return SUPPORTED_EXTENSIONS.has(ext) && !hasIgnoredDir;
    });

    // Parse each file
    for (const file of parseable) {
        const ext = getExtension(file.path);
        let parsed;

        if (['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'].includes(ext)) {
            parsed = parseJavaScript(file.path, file.content);
        } else if (ext === '.py') {
            parsed = parsePython(file.path, file.content);
        }

        if (parsed) {
            modules.push(parsed.module);
            fileIndex[file.path] = parsed.module;

            // Collect import edges
            for (const imp of parsed.imports) {
                edges.push({
                    from: file.path,
                    to: imp.resolvedPath || imp.source,
                    type: 'import',
                    symbols: imp.symbols,
                });
            }
        }
    }

    // Identify logical groupings (directories as modules)
    const groups = identifyGroups(modules);

    return {
        modules,
        edges,
        groups,
        stats: {
            totalFiles: files.length,
            parsedFiles: parseable.length,
            totalModules: modules.length,
            totalEdges: edges.length,
            totalGroups: groups.length,
        },
    };
}

function parseJavaScript(filePath, content) {
    const lines = content.split('\n');
    const functions = [];
    const classes = [];
    const imports = [];
    const exports = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Imports
        const importMatch = line.match(
            /import\s+(?:(?:\{([^}]+)\})|(?:(\w+)))?\s*(?:,\s*(?:\{([^}]+)\}|\*\s+as\s+(\w+)))?\s*from\s+['"]([^'"]+)['"]/
        );
        if (importMatch) {
            const symbols = [];
            if (importMatch[1]) symbols.push(...importMatch[1].split(',').map(s => s.trim().split(' as ')[0]));
            if (importMatch[2]) symbols.push(importMatch[2]);
            if (importMatch[3]) symbols.push(...importMatch[3].split(',').map(s => s.trim().split(' as ')[0]));
            if (importMatch[4]) symbols.push(importMatch[4]);
            imports.push({ source: importMatch[5], symbols, line: i + 1 });
        }

        // require()
        const requireMatch = line.match(/(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/);
        if (requireMatch) {
            const symbols = [];
            if (requireMatch[1]) symbols.push(...requireMatch[1].split(',').map(s => s.trim()));
            if (requireMatch[2]) symbols.push(requireMatch[2]);
            imports.push({ source: requireMatch[3], symbols, line: i + 1 });
        }

        // Function declarations
        const funcMatch = line.match(
            /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/
        );
        if (funcMatch) {
            functions.push({ name: funcMatch[1], line: i + 1, exported: line.includes('export') });
        }

        // Arrow functions assigned to const
        const arrowMatch = line.match(
            /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/
        );
        if (arrowMatch) {
            functions.push({ name: arrowMatch[1], line: i + 1, exported: line.includes('export') });
        }

        // Class declarations
        const classMatch = line.match(
            /(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?/
        );
        if (classMatch) {
            classes.push({
                name: classMatch[1],
                extends: classMatch[2] || null,
                line: i + 1,
                exported: line.includes('export'),
            });
        }

        // Export tracking
        if (line.startsWith('export ') || line.startsWith('module.exports')) {
            exports.push({ line: i + 1, content: line.substring(0, 100) });
        }
    }

    return {
        module: {
            path: filePath,
            language: 'javascript',
            functions,
            classes,
            exports,
            lineCount: lines.length,
        },
        imports,
    };
}

function parsePython(filePath, content) {
    const lines = content.split('\n');
    const functions = [];
    const classes = [];
    const imports = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Imports
        const fromImportMatch = trimmed.match(/from\s+([\w.]+)\s+import\s+(.+)/);
        if (fromImportMatch) {
            const symbols = fromImportMatch[2].split(',').map(s => s.trim().split(' as ')[0]);
            imports.push({ source: fromImportMatch[1], symbols, line: i + 1 });
        }

        const importMatch = trimmed.match(/^import\s+([\w.]+)(?:\s+as\s+\w+)?$/);
        if (importMatch) {
            imports.push({ source: importMatch[1], symbols: [importMatch[1]], line: i + 1 });
        }

        // Function definitions
        const funcMatch = trimmed.match(/^(?:async\s+)?def\s+(\w+)\s*\(/);
        if (funcMatch) {
            const indent = line.length - line.trimStart().length;
            functions.push({
                name: funcMatch[1],
                line: i + 1,
                indent,
                isMethod: indent > 0,
            });
        }

        // Class definitions
        const classMatch = trimmed.match(/^class\s+(\w+)(?:\(([^)]*)\))?/);
        if (classMatch) {
            classes.push({
                name: classMatch[1],
                extends: classMatch[2] || null,
                line: i + 1,
            });
        }
    }

    return {
        module: {
            path: filePath,
            language: 'python',
            functions,
            classes,
            exports: [],
            lineCount: lines.length,
        },
        imports,
    };
}

function identifyGroups(modules) {
    const dirMap = {};

    for (const mod of modules) {
        const parts = mod.path.split('/');
        if (parts.length > 1) {
            const dir = parts.slice(0, -1).join('/');
            if (!dirMap[dir]) {
                dirMap[dir] = { path: dir, files: [], functions: 0, classes: 0 };
            }
            dirMap[dir].files.push(mod.path);
            dirMap[dir].functions += mod.functions.length;
            dirMap[dir].classes += mod.classes.length;
        }
    }

    // Identify logical modules by naming patterns
    return Object.values(dirMap).map(group => {
        const dirName = group.path.split('/').pop().toLowerCase();
        const tags = [];

        if (['auth', 'authentication', 'login', 'session'].some(k => dirName.includes(k))) tags.push('auth');
        if (['api', 'routes', 'handlers', 'controllers', 'endpoints'].some(k => dirName.includes(k))) tags.push('api');
        if (['model', 'schema', 'entity', 'db', 'database', 'store'].some(k => dirName.includes(k))) tags.push('data');
        if (['util', 'helper', 'lib', 'common', 'shared'].some(k => dirName.includes(k))) tags.push('utility');
        if (['test', 'spec', '__test__'].some(k => dirName.includes(k))) tags.push('test');
        if (['component', 'view', 'page', 'ui', 'widget'].some(k => dirName.includes(k))) tags.push('frontend');
        if (['middleware', 'interceptor', 'filter'].some(k => dirName.includes(k))) tags.push('middleware');
        if (['config', 'settings', 'env'].some(k => dirName.includes(k))) tags.push('config');
        if (['service', 'worker', 'job', 'queue', 'task'].some(k => dirName.includes(k))) tags.push('service');
        if (['deploy', 'infra', 'ci', 'docker', 'k8s'].some(k => dirName.includes(k))) tags.push('infra');

        if (tags.length === 0) tags.push('module');

        return { ...group, tags };
    });
}

function getExtension(filePath) {
    const dot = filePath.lastIndexOf('.');
    return dot !== -1 ? filePath.substring(dot) : '';
}
