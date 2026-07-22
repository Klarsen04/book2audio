"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Flashcard {
  id: string;
  front: string;
  back: string;
}

interface Props {
  docId: string;
}

export default function FlashcardsView({ docId }: Props) {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const storageKey = `flashcards_${docId}`;

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setCards(JSON.parse(saved));
  }, [storageKey]);

  const save = (updated: Flashcard[]) => {
    setCards(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const addCard = () => {
    if (!newFront.trim() || !newBack.trim()) return;
    save([...cards, { id: Math.random().toString(36).slice(2), front: newFront, back: newBack }]);
    setNewFront("");
    setNewBack("");
    setIsEditing(false);
  };

  const removeCard = (id: string) => {
    const updated = cards.filter((c) => c.id !== id);
    save(updated);
    if (currentIndex >= updated.length) setCurrentIndex(Math.max(0, updated.length - 1));
  };

  const next = () => {
    setFlipped(false);
    setCurrentIndex((i) => (i + 1) % cards.length);
  };

  const prev = () => {
    setFlipped(false);
    setCurrentIndex((i) => (i - 1 + cards.length) % cards.length);
  };

  if (cards.length === 0 && !isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-2xl p-8 text-center"
      >
        <div className="text-4xl mb-4">🃏</div>
        <h3 className="text-lg font-semibold text-white mb-2">Flashcards</h3>
        <p className="text-sm text-gray-400 mb-6 max-w-sm mx-auto">
          Create flashcards from your reading to test yourself. Great for active recall studying.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-semibold hover:from-purple-500 hover:to-blue-500 transition-all hover:scale-105 active:scale-[0.98]"
        >
          Create First Card
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong rounded-2xl overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <span className="text-sm font-medium text-gray-200">
          Flashcards ({cards.length})
        </span>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.06] transition-all"
        >
          {isEditing ? "Done" : "+ Add"}
        </button>
      </div>

      {isEditing ? (
        <div className="p-5 space-y-3">
          <input
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            placeholder="Question / Front side"
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-500 focus:border-purple-500/50 focus:outline-none"
          />
          <textarea
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder="Answer / Back side"
            rows={3}
            className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white text-sm placeholder-gray-500 focus:border-purple-500/50 focus:outline-none resize-none"
          />
          <button
            onClick={addCard}
            disabled={!newFront.trim() || !newBack.trim()}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 text-sm font-semibold disabled:opacity-50 transition-all"
          >
            Add Card
          </button>
        </div>
      ) : (
        <div className="p-5">
          {/* Card display */}
          <div
            onClick={() => setFlipped(!flipped)}
            className="relative h-48 cursor-pointer perspective-1000"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={flipped ? "back" : "front"}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className={`absolute inset-0 flex items-center justify-center p-6 rounded-xl text-center ${
                  flipped
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-white/[0.04] border border-white/[0.08]"
                }`}
              >
                <div>
                  <p className="text-xs text-gray-500 mb-2">{flipped ? "Answer" : "Question"}</p>
                  <p className="text-gray-200 text-sm leading-relaxed">
                    {flipped ? cards[currentIndex]?.back : cards[currentIndex]?.front}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={prev}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                {currentIndex + 1} / {cards.length}
              </span>
              <button
                onClick={() => removeCard(cards[currentIndex]?.id)}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Delete
              </button>
            </div>
            <button
              onClick={next}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-all"
            >
              Next →
            </button>
          </div>

          <p className="text-center text-[10px] text-gray-600 mt-3">
            Click the card to flip it
          </p>
        </div>
      )}
    </motion.div>
  );
}
