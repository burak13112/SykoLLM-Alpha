import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { Icons } from './Icon';

interface ChatMessageProps {
  message: Message;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Parsing Logic for <think> blocks
  const parseContent = (content: string) => {
    const cleanContent = content.trimStart();
    if (message.role === 'model' && cleanContent.startsWith('<think>')) {
      const closingIndex = cleanContent.indexOf('</think>');
      if (closingIndex !== -1) {
        const thought = cleanContent.substring(7, closingIndex).trim();
        const actualResponse = cleanContent.substring(closingIndex + 8).trim();
        return { hasThought: true, thought, content: actualResponse, isThinking: false };
      } else {
        const thought = cleanContent.substring(7).trim();
        return { hasThought: true, thought, content: '', isThinking: true };
      }
    }
    return { hasThought: false, thought: '', content: content, isThinking: false };
  };

  const { hasThought, thought, content, isThinking } = parseContent(message.content);

  return (
    <div className={`w-full animate-slide-up ${isUser ? 'bg-transparent' : 'bg-black/5 dark:bg-white/5 border-y border-black/5 dark:border-white/5'}`}>
      <div className="max-w-3xl mx-auto py-8 px-4 md:px-6 flex gap-4 md:gap-6">
        <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
          isUser 
            ? 'bg-black text-white dark:bg-white dark:text-black' 
            : 'bg-gradient-to-br from-gray-700 to-black text-white dark:from-gray-200 dark:to-white dark:text-black'
        }`}>
          {isUser ? <Icons.Terminal size={16} /> : <Icons.Cpu size={16} />}
        </div>

        <div className="flex-1 min-w-0 space-y-2 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-bold text-sm tracking-wide">
              {isUser ? 'YOU' : 'SYKO LLM'}
            </span>
            {!isUser && (
              <span className="text-[10px] bg-red-600 text-white px-1 rounded font-bold uppercase">
                ALPHA
              </span>
            )}
          </div>
          
          {/* DISPLAY IMAGES IF ATTACHED */}
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {message.images.map((img, i) => (
                <img 
                  key={i} 
                  src={img} 
                  alt="Attachment" 
                  className="max-h-64 rounded-xl border border-black/10 dark:border-white/10 shadow-sm"
                />
              ))}
            </div>
          )}
          
          {/* THINKING MODULE UI */}
          {hasThought && (
            <div className="mb-4 mt-2">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity select-none group"
              >
                {isExpanded ? <Icons.ChevronDown size={14} /> : <Icons.ChevronRight size={14} />}
                <Icons.Brain size={14} className={isThinking ? "animate-pulse text-indigo-500" : ""} />
                <span className={isThinking ? "animate-pulse" : ""}>
                  {isThinking ? "GENERATING THOUGHT PROCESS..." : "THOUGHT PROCESS"}
                </span>
                {!isExpanded && !isThinking && (
                   <span className="text-[10px] normal-case opacity-50 ml-2 tracking-normal border border-current px-1 rounded">Click to expand</span>
                )}
              </button>
              {isExpanded && (
                <div className="mt-2 pl-4 border-l-2 border-black/10 dark:border-white/10 animate-fade-in">
                  <div className="text-sm font-mono text-gray-600 dark:text-gray-400 italic leading-relaxed opacity-90 break-words whitespace-pre-wrap">
                    {thought || <span className="opacity-50">Thinking...</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MAIN CONTENT */}
          <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-pre:bg-black/10 dark:prose-pre:bg-black prose-pre:rounded-lg ${message.isError ? 'text-red-500 font-medium' : ''}`}>
             <ReactMarkdown>{content}</ReactMarkdown>
             {!content && !isThinking && hasThought && (
               <span className="animate-pulse inline-block w-2 h-4 bg-current align-middle ml-1"></span>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};