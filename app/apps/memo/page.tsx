"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./memo.module.css";

const STORAGE_KEY = "workbench-memo";

export default function MemoPage() {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setText(stored);
  }, []);

  const save = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }, [text]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Memo</h1>
        <button className={styles.saveBtn} onClick={save}>
          Save
        </button>
      </div>
      <textarea
        className={styles.editor}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write something..."
      />
      {saved && <div className={styles.status}>Saved to localStorage</div>}
    </div>
  );
}
