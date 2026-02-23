import '../styles/ChatMessage.css';

export default function ChatMessage({ role, content, streaming }) {
    const isUser = role === 'user';

    return (
        <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
            {!isUser && (
                <div className="avatar avatar-ai">AI</div>
            )}
            <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-ai'} ${streaming ? 'streaming' : ''}`}>
                {content}
                {streaming && <span className="cursor-blink" />}
            </div>
            {isUser && (
                <div className="avatar avatar-user">You</div>
            )}
        </div>
    );
}
