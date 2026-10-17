import React from "react";
import { createRoot } from "react-dom/client";
import Hub from "./Hub.jsx";
import { createStore } from "./data/store.js";
import "./styles/utilities.css";
import "./styles/theme.css";

const root = createRoot(document.getElementById("root"));
root.render(
  <p className="startup-message" role="status">
    正在載入工具清單…
  </p>,
);

async function start() {
  try {
    const store = await createStore();
    const snapshot = await store.load();
    root.render(
      <React.StrictMode>
        <Hub store={store} initialSnapshot={snapshot} />
      </React.StrictMode>,
    );
  } catch (error) {
    root.render(
      <main className="startup-message">
        <h1>暫時無法載入工具清單</h1>
        <p role="alert">{error.message}</p>
        <p>為免誤以為已成功發布，系統不會在雲端錯誤時切換成本機儲存。</p>
        <button
          className="primary-button"
          onClick={() => window.location.reload()}
        >
          重新載入 ↻
        </button>
      </main>,
    );
  }
}
start();
