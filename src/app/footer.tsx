"use client";

export function Footer() {
  return (
    <footer className="bg-white dark:bg-dark-card border-t border-gray-200 dark:border-dark-border mt-12 py-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-4 text-center">
        <p className="font-bold text-gray-800 dark:text-gray-200 text-lg">
          TTS Pro &mdash; Free AI Text to Speech &amp; Pet News Studio
        </p>
        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mt-2">
          Powered by Microsoft Edge TTS, ONNX Runtime &amp; TensorFlow.js — runs entirely in your browser.
        </p>
      </div>
    </footer>
  );
}
