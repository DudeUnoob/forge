import { buildChatMessages } from './chatHistory.js';

describe('buildChatMessages', () => {
    test('returns only the current user message when history is empty', () => {
        const result = buildChatMessages([], 'How does this block work?');

        expect(result).toEqual([
            { role: 'user', content: 'How does this block work?' },
        ]);
    });

    test('drops invalid assistant-first prefix and keeps valid alternating turns', () => {
        const history = [
            { role: 'assistant', content: 'Welcome' },
            { role: 'user', content: 'First real question' },
            { role: 'assistant', content: 'First answer' },
        ];

        const result = buildChatMessages(history, 'Follow-up question');

        expect(result).toEqual([
            { role: 'user', content: 'First real question' },
            { role: 'assistant', content: 'First answer' },
            { role: 'user', content: 'Follow-up question' },
        ]);
    });

    test('repairs consecutive same-role messages via strict alternation', () => {
        const history = [
            { role: 'user', content: 'Q1' },
            { role: 'user', content: 'Q2 duplicate user' },
            { role: 'assistant', content: 'A1' },
            { role: 'assistant', content: 'A2 duplicate assistant' },
            { role: 'user', content: 'Q3 trailing user' },
        ];

        const result = buildChatMessages(history, 'Q4 latest');

        expect(result).toEqual([
            { role: 'user', content: 'Q1' },
            { role: 'assistant', content: 'A1' },
            { role: 'user', content: 'Q4 latest' },
        ]);
    });

    test('drops empty or malformed entries before rebuilding history', () => {
        const history = [
            { role: 'user', content: '   ' },
            { role: 'assistant', content: null },
            { role: 'system', content: 'ignore this role' },
            { role: 'assistant', content: 'kept content but wrong position' },
            { role: 'user', content: 42 },
        ];

        const result = buildChatMessages(history, 'Current question');

        expect(result).toEqual([
            { role: 'user', content: 'Current question' },
        ]);
    });

    test('always starts with user and ends with the current user message', () => {
        const history = [
            { role: 'assistant', content: 'A0' },
            { role: 'assistant', content: 'A1' },
            { role: 'user', content: 'Q1' },
            { role: 'assistant', content: 'A2' },
        ];

        const currentQuestion = 'Newest question';
        const result = buildChatMessages(history, currentQuestion);

        expect(result[0].role).toBe('user');
        expect(result[result.length - 1]).toEqual({
            role: 'user',
            content: currentQuestion,
        });
    });
});
