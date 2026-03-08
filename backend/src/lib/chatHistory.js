function normalizeRole(role) {
    if (typeof role !== 'string') return null;
    const normalized = role.trim().toLowerCase();
    return normalized === 'user' || normalized === 'assistant' ? normalized : null;
}

function normalizeContent(content) {
    if (typeof content === 'string') return content.trim();
    if (content === null || content === undefined) return '';
    return String(content).trim();
}

export function normalizeHistory(history) {
    const items = Array.isArray(history) ? history : [];

    return items
        .map((item) => {
            const role = normalizeRole(item?.role);
            const content = normalizeContent(item?.content);
            if (!role || !content) return null;
            return { role, content };
        })
        .filter(Boolean);
}

export function buildChatMessages(history, currentUserMessage) {
    const currentContent = normalizeContent(currentUserMessage);
    const currentTurn = { role: 'user', content: currentContent };
    const normalized = normalizeHistory(history);

    const rebuilt = [];
    let expectedRole = 'user';

    for (const message of normalized) {
        if (message.role !== expectedRole) continue;
        rebuilt.push(message);
        expectedRole = expectedRole === 'user' ? 'assistant' : 'user';
    }

    if (rebuilt.length > 0 && rebuilt[rebuilt.length - 1].role === 'user') {
        rebuilt.pop();
    }

    const messages = [...rebuilt, currentTurn];
    if (messages.length === 0 || messages[0].role !== 'user') {
        return [currentTurn];
    }

    return messages;
}
