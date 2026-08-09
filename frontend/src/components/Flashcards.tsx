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
        className="bg-surface-hover border border-hairline-strong rounded-sm p-8 text-center"
      >
        <div className="text-4xl mb-4">🃏</div>
        <h3 className="font-display text-2xl text-paper mb-2">Flashcards</h3>
        <p className="text-sm font-serif text-paper/60 mb-6 max-w-sm mx-auto">
          Create flashcards from your reading to test yourself. Great for active recall studying.
        </p>
        <button
          onClick={() => setIsEditing(true)}
          className="px-5 py-2.5 rounded-full bg-gold text-ink text-sm font-semibold hover:bg-gold-soft transition-all hover:scale-105 active:scale-[0.98]"
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
      className="bg-surface-hover border border-hairline-strong rounded-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
        <span className="font-display text-lg text-paper">
          Flashcards ({cards.length})
        </span>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="text-xs text-paper/60 hover:text-paper px-3 py-1.5 rounded-sm hover:bg-surface transition-all"
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
            className="w-full px-4 py-3 bg-surface border border-hairline rounded-sm text-paper font-serif text-sm placeholder-paper/40 focus:border-gold/40 focus:outline-none"
          />
          <textarea
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            placeholder="Answer / Back side"
            rows={3}
            className="w-full px-4 py-3 bg-surface border border-hairline rounded-sm text-paper font-serif text-sm placeholder-paper/40 focus:border-gold/40 focus:outline-none resize-none"
          />
          <button
            onClick={addCard}
            disabled={!newFront.trim() || !newBack.trim()}
            className="w-full py-2.5 rounded-sm bg-gold text-ink text-sm font-semibold disabled:opacity-50 transition-all"
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
                className={`absolute inset-0 flex items-center justify-center p-6 rounded-sm text-center ${
                  flipped
                    ? "bg-gold/10 border border-gold/30"
                    : "bg-surface border border-hairline"
                }`}
              >
                <div>
                  <p className="label-mono text-paper/40 mb-2">{flipped ? "Answer" : "Question"}</p>
                  <p className="text-paper font-serif text-sm leading-relaxed">
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
              className="px-4 py-2 text-sm text-paper/60 hover:text-paper hover:bg-surface rounded-sm transition-all"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-3">
              <span className="label-mono text-paper/40">
                {currentIndex + 1} / {cards.length}
              </span>
              <button
                onClick={() => removeCard(cards[currentIndex]?.id)}
                className="text-xs text-paper/40 hover:text-burgundy-soft transition-colors"
              >
                Delete
              </button>
            </div>
            <button
              onClick={next}
              className="px-4 py-2 text-sm text-paper/60 hover:text-paper hover:bg-surface rounded-sm transition-all"
            >
              Next →
            </button>
          </div>

          <p className="text-center label-mono text-paper/40 mt-3">
            Click the card to flip it
          </p>
        </div>
      )}
    </motion.div>
  );
}
