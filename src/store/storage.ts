import { createJSONStorage, type StateStorage } from 'zustand/middleware';

// プライベートウィンドウなどで localStorage が使えなくても動くようにする（保存されないだけ）
const safeLocalStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // 保存できなくても続行する
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      // 同上
    }
  },
};

export const safeStorage = createJSONStorage(() => safeLocalStorage);
