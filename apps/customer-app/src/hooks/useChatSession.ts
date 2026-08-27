import { useEffect, useRef, useState } from 'react';
import { client } from '../api/client';

export function useChatSession() {
  const [history, setHistory] = useState<{ sender: 'bot' | 'user', text: string }[]>([]);
  const [currentNode, setCurrentNode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [isEscalating, setIsEscalating] = useState(false);
  const [escName, setEscName] = useState("");
  const [escContact, setEscContact] = useState("");
  const [escBody, setEscBody] = useState("");

  const [userInput, setUserInput] = useState("");

  // Mirrors isEscalating for synchronous reads inside in-flight requests.
  // startChat() can still be awaiting its response when the user triggers
  // CHAT_ESCALATE_EVENT (ChatPanel calls startEscalation() directly while
  // the panel is already open) — without this, the stale response's
  // setHistory/setCurrentNode would wipe the escalation bubble it just
  // added while isEscalating stayed true, leaving the form and the history
  // out of sync. Reading `isEscalating` itself inside the async closure
  // would only ever see the value from when startChat() was called.
  const isEscalatingRef = useRef(false);
  useEffect(() => {
    isEscalatingRef.current = isEscalating;
  }, [isEscalating]);

  const startChat = async () => {
    if (history.length > 0 && history[0].text !== "Failed to connect. Please try again.") return;
    setIsLoading(true);
    try {
      const { data, error } = await client.POST("/api/chat/message", { body: { node_id: "root", input: null } });
      // Escalation may have started while this request was in flight —
      // don't let a stale root-node response clobber it.
      if (isEscalatingRef.current) return;
      if (error) {
        setHistory([{ sender: 'bot', text: "Failed to connect. Please try again." }]);
        return;
      }
      if (data) {
        setCurrentNode(data);
        setHistory([{ sender: 'bot', text: (data as any).text }]);
      }
    } catch {
      if (isEscalatingRef.current) return;
      setHistory([{ sender: 'bot', text: "Failed to connect. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Entry point for the "Ask a bookseller" deep-link CTAs on Home.tsx: jumps
  // straight to the escalation form, skipping the root-node greeting. Mirrors
  // handleOption's `optId === "escalate"` branch, minus the user-facing quick
  // reply label (there's no quick-reply click to echo here) and minus
  // startChat's reconnect-avoidance guard, since this is an explicit
  // user-initiated transition rather than a panel-open side effect.
  const startEscalation = () => {
    setHistory(h => [...h, { sender: 'bot', text: "Please provide your details below to leave a message." }]);
    setIsEscalating(true);
    setCurrentNode(null);
  };

  const handleOption = async (optId: string, optLabel: string) => {
    if (optId === "escalate") {
      setHistory(h => [...h, { sender: 'user', text: optLabel }, { sender: 'bot', text: "Please provide your details below to leave a message." }]);
      setIsEscalating(true);
      setCurrentNode(null);
      return;
    }

    setHistory(h => [...h, { sender: 'user', text: optLabel }]);
    setIsLoading(true);
    try {
      const { data, error } = await client.POST("/api/chat/message", { body: { node_id: optId, input: null } });
      if (error) {
        setHistory(h => [...h, { sender: 'bot', text: "Failed to connect. Please try again." }]);
        return;
      }
      if (data) {
        setCurrentNode(data);
        setHistory(h => [...h, { sender: 'bot', text: (data as any).text }]);
      }
    } catch {
      setHistory(h => [...h, { sender: 'bot', text: "Failed to connect. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await client.POST("/api/chat/escalate", {
        body: { name: escName, contact: escContact, body: escBody }
      });
      if (error) {
        setHistory(h => [...h, { sender: 'bot', text: "Failed to send message. Please try again." }]);
        return;
      }
      setHistory(h => [...h, { sender: 'bot', text: "Thank you! Your message has been sent to our staff. We will get back to you shortly." }]);
      setIsEscalating(false);

      setTimeout(async () => {
        try {
          const { data, error } = await client.POST("/api/chat/message", { body: { node_id: "root", input: null } });
          if (!error && data) setCurrentNode(data);
        } catch {
          // Ignore error in background reset
        }
      }, 2000);
    } catch {
      setHistory(h => [...h, { sender: 'bot', text: "Failed to send message. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const submitInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    setHistory(h => [...h, { sender: 'user', text: userInput }]);
    setIsLoading(true);
    try {
      const { data, error } = await client.POST("/api/chat/message", {
        body: { node_id: "check_stock", input: userInput }
      });
      if (error) {
        setHistory(h => [...h, { sender: 'bot', text: "Failed to connect. Please try again." }]);
        return;
      }
      if (data) {
        setCurrentNode(data);
        setHistory(h => [...h, { sender: 'bot', text: (data as any).text }]);
      }
    } catch {
      setHistory(h => [...h, { sender: 'bot', text: "Failed to connect. Please try again." }]);
    } finally {
      setIsLoading(false);
      setUserInput("");
    }
  };

  return {
    history, setHistory,
    currentNode, setCurrentNode,
    isLoading, setIsLoading,
    isEscalating, setIsEscalating,
    escName, setEscName,
    escContact, setEscContact,
    escBody, setEscBody,
    userInput, setUserInput,
    startChat, startEscalation, handleOption, submitEscalation, submitInput
  };
}
